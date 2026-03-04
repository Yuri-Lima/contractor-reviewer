/**
 * Cache for chat prepare payloads (dev mode LLM payload preview).
 * Uses Redis with workspace/document-scoped keys for horizontal scaling.
 * TTL 5 minutes; one-time use (deleted after execute).
 */
import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { ChatPreparePayload } from '@contractai-review/shared';
import { REDIS_CLIENT } from '../queue/redis.provider';

const KEY_PREFIX = 'rag:prepare:';
const TTL_SECONDS = 300; // 5 minutes

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
      Array.isArray((parsed as ChatPreparePayload).contractChunks) &&
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
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: IORedis,
  ) {}

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
    await this.redis.set(key, value, 'EX', TTL_SECONDS);
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
