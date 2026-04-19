/**
 * Semantic RAG query cache backed by Redis.
 * Uses embedding cosine similarity to return cached responses for semantically similar questions.
 * Shares the BullMQ Redis connection. Keys prefixed with `rag:cache:` to avoid collisions.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { ChatResponse } from '@contractai-review/shared';
import { REDIS_CLIENT } from '../queue/redis.provider';

/** Key prefix for all RAG cache keys (distinct from BullMQ's prefix). */
const KEY_PREFIX = 'rag:cache:';
const KEY_DATA = (k: string) => `${KEY_PREFIX}data:${k}`;
const KEY_INDEX = (docId: string, jurisdiction: string, language: string) =>
  `${KEY_PREFIX}index:${docId}:${jurisdiction || 'none'}:${language || 'en'}`;
const KEY_DOC_KEYS = (docId: string) => `rag:doc:${docId}:keys`;
const KEY_DOC_INDEXES = (docId: string) => `rag:doc:${docId}:indexes`;

/** Stored in index list: embedding for similarity lookup, key to fetch cached response. */
interface CacheIndexEntry {
  embedding: number[];
  key: string;
  createdAt: number;
}

/**
 * Cosine similarity between two vectors. Returns [0, 1]; negative similarity is clamped to 0.
 * Uses full formula (dot / (normA * normB)) for robustness with any embedding provider.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  const sim = dot / denom;
  if (!Number.isFinite(sim)) return 0;
  return Math.max(0, Math.min(1, sim));
}

/** Parse index entry from Redis list; returns null for malformed data. */
function parseIndexEntry(raw: string): CacheIndexEntry | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as CacheIndexEntry).embedding) &&
      typeof (parsed as CacheIndexEntry).key === 'string' &&
      typeof (parsed as CacheIndexEntry).createdAt === 'number'
    ) {
      return parsed as CacheIndexEntry;
    }
  } catch {
    // Malformed entry - treat as cache miss
  }
  return null;
}

/** Parse cached ChatResponse from Redis; returns null for malformed data. */
function parseCachedResponse(raw: string): ChatResponse | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as ChatResponse).answerText === 'string' &&
      Array.isArray((parsed as ChatResponse).citations)
    ) {
      return parsed as ChatResponse;
    }
  } catch {
    // Malformed - cache miss
  }
  return null;
}

@Injectable()
export class RagCacheService {
  private readonly enabled: boolean;
  private readonly ttlSeconds: number;
  private readonly defaultThreshold: number;
  private readonly maxEntriesPerDoc: number;

  /** Uses shared REDIS_CLIENT (BullMQ connection). Config from env: RAG_CACHE_*. */
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: IORedis,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<string>('RAG_CACHE_ENABLED') !== 'false';
    this.ttlSeconds = this.configService.get<number>('RAG_CACHE_TTL_SECONDS') ?? 86400;
    // NOTE: This threshold compares QUESTION embeddings (cache-key matching).
    // Distinct from RAG_SIMILARITY_FLOOR which gates DOCUMENT CHUNK retrieval
    // in RagService. The two thresholds are mathematically independent —
    // changing one does not affect the other.
    this.defaultThreshold =
      this.configService.get<number>('RAG_CACHE_SIMILARITY_THRESHOLD') ?? 0.95;
    this.maxEntriesPerDoc =
      this.configService.get<number>('RAG_CACHE_MAX_ENTRIES_PER_DOCUMENT') ?? 50;
  }

  /**
   * Look up cached response by semantic similarity.
   * Returns cached response if max(similarity) >= threshold, else null.
   */
  async get(
    documentId: string,
    jurisdiction: string | undefined,
    questionEmbedding: number[],
    language: string,
    options?: { similarityThreshold?: number },
  ): Promise<ChatResponse | null> {
    if (!this.enabled) return null;
    const threshold = options?.similarityThreshold ?? this.defaultThreshold;
    const indexKey = KEY_INDEX(documentId, jurisdiction ?? 'none', language ?? 'en');

    try {
      const rawList = await this.redis.lrange(indexKey, 0, -1);
      let bestKey: string | null = null;
      let bestSim = 0;

      /* Find best-matching cached embedding by cosine similarity */
      for (const raw of rawList) {
        const entry = parseIndexEntry(raw);
        if (!entry) continue;
        const sim = cosineSimilarity(questionEmbedding, entry.embedding);
        if (sim >= threshold && sim > bestSim) {
          bestSim = sim;
          bestKey = entry.key;
        }
      }

      if (!bestKey) return null;

      const dataRaw = await this.redis.get(KEY_DATA(bestKey));
      if (!dataRaw) return null;

      const response = parseCachedResponse(dataRaw);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[RagCacheService] get error (cache disabled for this request):', msg);
      return null;
    }
  }

  /**
   * Store response in cache (atomic via MULTI/EXEC).
   */
  async set(
    documentId: string,
    jurisdiction: string | undefined,
    questionEmbedding: number[],
    language: string,
    response: ChatResponse,
  ): Promise<void> {
    if (!this.enabled) return;
    const cacheKey = randomUUID();
    const indexKey = KEY_INDEX(documentId, jurisdiction ?? 'none', language ?? 'en');
    const entry: CacheIndexEntry = { embedding: questionEmbedding, key: cacheKey, createdAt: Date.now() };
    const dataKey = KEY_DATA(cacheKey);
    const dataValue = JSON.stringify(response);
    const docKeysKey = KEY_DOC_KEYS(documentId);
    const docIndexesKey = KEY_DOC_INDEXES(documentId);

    try {
      const multi = this.redis.multi();
      multi.set(dataKey, dataValue, 'EX', this.ttlSeconds);
      multi.lpush(indexKey, JSON.stringify(entry));
      multi.ltrim(indexKey, 0, this.maxEntriesPerDoc - 1); /* FIFO cap */
      multi.sadd(docKeysKey, cacheKey);
      multi.sadd(docIndexesKey, indexKey);
      await multi.exec();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[RagCacheService] set error (cache store skipped):', msg);
    }
  }

  /**
   * Invalidate all cache entries for a document (atomic via MULTI/EXEC).
   */
  async invalidateDocument(documentId: string): Promise<void> {
    if (!this.enabled) return;
    const docKeysKey = KEY_DOC_KEYS(documentId);
    const docIndexesKey = KEY_DOC_INDEXES(documentId);

    try {
      const [dataKeys, indexKeys] = await Promise.all([
        this.redis.smembers(docKeysKey),
        this.redis.smembers(docIndexesKey),
      ]);

      if (dataKeys.length === 0 && indexKeys.length === 0) return;

      const multi = this.redis.multi();
      /* Delete all data keys, index keys, and tracking sets atomically */
      for (const k of dataKeys) {
        multi.del(KEY_DATA(k));
      }
      for (const ik of indexKeys) {
        multi.del(ik);
      }
      multi.del(docKeysKey, docIndexesKey);
      await multi.exec();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[RagCacheService] invalidateDocument error:', msg);
    }
  }
}
