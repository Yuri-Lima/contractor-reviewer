import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, JobStatus } from '../entities/document-job.entity';
import { CHUNK_REPOSITORY, IChunkRepository } from '../chunks/chunk-repository.interface';
import { EmbeddingsService } from '../rag/embeddings.service';
import { needsReembed } from '../rag/embedding-model.util';
import { RagCacheService } from '../cache/rag-cache.service';
import { JobProgressPublisher } from './job-progress.publisher';
import { abortAsPromise } from '../common/utils/abort-promise';

interface EmbeddingsJobData {
  jobId: string;
  documentId: string;
  chunkIds: string[];
}

@Processor('embeddings', {
  stalledInterval: 60000,
  maxStalledCount: 1,
})
@Injectable()
export class EmbeddingsProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingsProcessor.name);

  constructor(
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @Inject(CHUNK_REPOSITORY)
    private chunkRepository: IChunkRepository,
    private embeddingsService: EmbeddingsService,
    private ragCacheService: RagCacheService,
    private jobProgressPublisher: JobProgressPublisher,
  ) {
    super();
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress?: number,
    error?: string,
  ): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = status;
    if (progress !== undefined) {
      job.progress = progress;
    }
    if (error) {
      job.lastError = error;
      job.attempts += 1;
    }

    // Explicitly update updatedAt to ensure change detection
    job.updatedAt = new Date();
    
    await this.jobRepository.save(job);
    
    const finalProgress = progress !== undefined ? progress : job.progress;
    this.logger.log(`[PROGRESS] Job ${jobId} (${job.type}): status=${status}, progress=${finalProgress}%`);
    this.jobProgressPublisher.publish(job.documentId, job).catch(() => {});
  }

  async process(
    job: Job<EmbeddingsJobData>,
    _token?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { jobId, documentId, chunkIds } = job.data;

    this.logger.log(`[Embeddings] Start jobId=${jobId} documentId=${documentId} chunkCount=${chunkIds.length}`);

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 0);

      // Load chunks
      const chunks = await this.chunkRepository.findByIds(chunkIds);

      if (chunks.length === 0) {
        throw new Error('No chunks found');
      }

      // Re-embed missing vectors OR vectors produced by a different model
      // (prevents silent mixed-model recall degradation).
      const activeModel = this.embeddingsService.modelName;
      const chunksToEmbed = chunks.filter((c) =>
        needsReembed(!!c.embedding, c.embeddingModel, activeModel),
      );

      if (chunksToEmbed.length === 0) {
        await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
        await this.ragCacheService.invalidateDocument(documentId);
        return;
      }

      // Generate embeddings in batches
      const batchSize = 100;
      let processed = 0;

      for (let i = 0; i < chunksToEmbed.length; i += batchSize) {
        const batch = chunksToEmbed.slice(i, i + batchSize);
        const texts = batch.map((c) => c.text);

        await this.updateJobStatus(
          jobId,
          JobStatus.PROCESSING,
          Math.floor((processed / chunksToEmbed.length) * 90),
        );

        // Generate embeddings (best-effort cancellation via signal)
        let embedPromise = this.embeddingsService.generateEmbeddings(texts, {
          signal,
        });
        if (signal) {
          embedPromise = Promise.race([
            embedPromise,
            abortAsPromise(signal),
          ]);
        }
        const embeddings = await embedPromise;

        // Update chunks with embeddings + model identity
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = embeddings[j];
          batch[j].embeddingModel = activeModel;
        }

        await this.chunkRepository.save(batch);
        processed += batch.length;
      }

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
      await this.ragCacheService.invalidateDocument(documentId);
      this.logger.log(`[Embeddings] Job completed`, { jobId, documentId });
    } catch (error) {
      await this.updateJobStatus(
        jobId,
        JobStatus.FAILED,
        undefined,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
