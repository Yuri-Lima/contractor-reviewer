/**
 * Cache for chat prepare payloads (dev mode LLM payload preview).
 * Uses Redis with workspace/document-scoped keys for horizontal scaling.
 * TTL configurable via CHAT_PREPARE_TTL_SECONDS (default 15 min);
 * one-time use (deleted after execute).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { ChatPreparePayload } from '@contractai-review/shared';
import { REDIS_CLIENT } from '../queue/redis.provider';

const KEY_PREFIX = 'rag:prepare:';
const DEFAULT_TTL_SECONDS = 900; // 15 minutes

const buildKey = (workspaceId: string, documentId: string, requestId: string) =>
  `${KEY_PREFIX}${workspaceId}:${documentId}:${requestId}`;

function parsePayload(raw: string | null): ChatPreparePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as ChatPreparePayload).systemPrompt === 'string' &&
      typeof (parsed as ChatPreparePayload).userPrompt === 'string' &&
      Array.isArray((parsed as ChatPreparePayload).documentChunks) &&
      Array.isArray((parsed as ChatPreparePayload).legalChunks)
    ) {
      return parsed as ChatPreparePayload;
    }
  } catch {
    // Malformed - treat as miss
  }
  return null;
}

@Injectable()
export class ChatPrepareCacheService {
  private readonly logger = new Logger(ChatPrepareCacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: IORedis,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('CHAT_PREPARE_TTL_SECONDS');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    this.ttlSeconds = parsed > 0 ? parsed : DEFAULT_TTL_SECONDS;
  }

  /**
   * Store a prepared payload. Returns the requestId used.
   */
  async set(
    workspaceId: string,
    documentId: string,
    payload: ChatPreparePayload,
  ): Promise<string> {
    const requestId = randomUUID();
    const key = buildKey(workspaceId, documentId, requestId);
    const value = JSON.stringify(payload);
    await this.redis.set(key, value, 'EX', this.ttlSeconds);
    this.logger.log('[ChatPrepare] Payload stored', {
      workspaceId,
      documentId,
      requestId,
    });
    return requestId;
  }

  /**
   * Get a prepared payload. Returns null if not found or expired.
   * Does NOT delete - caller (execute) must delete after use.
   */
  async get(
    workspaceId: string,
    documentId: string,
    requestId: string,
  ): Promise<ChatPreparePayload | null> {
    const key = buildKey(workspaceId, documentId, requestId);
    const raw = await this.redis.get(key);
    return parsePayload(raw);
  }

  /**
   * Get and delete (one-time use). Returns null if not found or expired.
   */
  async getAndDelete(
    workspaceId: string,
    documentId: string,
    requestId: string,
  ): Promise<ChatPreparePayload | null> {
    const key = buildKey(workspaceId, documentId, requestId);
    const raw = await this.redis.get(key);
    const payload = parsePayload(raw);
    if (payload) {
      await this.redis.del(key);
    }
    return payload;
  }
}
