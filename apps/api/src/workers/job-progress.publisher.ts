import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import IORedis from 'ioredis';
import { JOB_PROGRESS_EVENT } from '@contractai-review/shared';
import { DocumentJob } from '../entities/document-job.entity';
import { Document } from '../entities/document.entity';
import { REDIS_CLIENT } from '../queue/redis.provider';

const MAXLEN = 10000;

/** Serialize DocumentJob entity for Redis Stream payload (date objects to ISO strings) */
function serializeJob(job: DocumentJob): Record<string, unknown> {
  return {
    id: job.id,
    documentId: job.documentId,
    type: job.type,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    lastError: job.lastError ?? null,
    metadata: job.metadata ?? null,
    createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : String(job.createdAt),
    updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : String(job.updatedAt),
  };
}

@Injectable()
export class JobProgressPublisher {
  private readonly logger = new Logger(JobProgressPublisher.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: IORedis,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  /**
   * Publish job progress to Redis Stream for WebSocket consumers.
   * If workspaceId is not provided, looks it up from the document.
   */
  async publish(documentId: string, job: DocumentJob, workspaceId?: string): Promise<void> {
    let wsId = workspaceId;
    if (!wsId) {
      const doc = await this.documentRepository.findOne({
        where: { id: documentId },
        select: ['workspaceId'],
      });
      wsId = doc?.workspaceId;
    }
    if (!wsId) {
      this.logger.warn(`[JobProgressPublisher] No workspaceId for document ${documentId}, skipping publish`);
      return;
    }

    try {
      const payload = JSON.stringify(serializeJob(job));
      await this.redis.xadd(
        JOB_PROGRESS_EVENT,
        'MAXLEN',
        '~',
        String(MAXLEN),
        '*',
        'documentId',
        documentId,
        'workspaceId',
        wsId,
        'payload',
        payload,
      );
    } catch (err) {
      this.logger.error(`[JobProgressPublisher] Failed to publish: ${err instanceof Error ? err.message : String(err)}`);
      // Don't throw - job progress in DB is the source of truth; WS is best-effort
    }
  }
}
