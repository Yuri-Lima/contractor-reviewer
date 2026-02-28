import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, JobStatus, JobType } from '../entities/document-job.entity';
import { Document } from '../entities/document.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { CHUNK_REPOSITORY, IChunkRepository } from '../chunks/chunk-repository.interface';
import { ChunkingService } from '../rag/chunking.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { abortAsPromise } from '../common/utils/abort-promise';

interface ChunkingJobData {
  jobId: string;
  documentId: string;
  fileId: string;
  text: string;
  pageCount?: number;
}

@Processor('chunking', {
  stalledInterval: 30000,
  maxStalledCount: 1,
})
@Injectable()
export class ChunkingProcessor extends WorkerHost {
  private readonly logger = new Logger(ChunkingProcessor.name);

  constructor(
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @Inject(CHUNK_REPOSITORY)
    private chunkRepository: IChunkRepository,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(WorkspaceSettings)
    private workspaceSettingsRepository: Repository<WorkspaceSettings>,
    private chunkingService: ChunkingService,
    @InjectQueue('embeddings')
    private embeddingsQueue: Queue,
  ) {
    super();
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMsg: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${errorMsg} (timeout after ${timeoutMs}ms)`)),
          timeoutMs,
        ),
      ),
    ]);
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
    
    // Log progress update for debugging
    const finalProgress = progress !== undefined ? progress : job.progress;
    this.logger.log(`[PROGRESS] Job ${jobId} (${job.type}): status=${status}, progress=${finalProgress}%`);
  }

  async process(
    job: Job<ChunkingJobData>,
    _token?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { jobId, documentId, text, pageCount } = job.data;

    this.logger.log(
      `Starting chunking job ${jobId} for document ${documentId} (${text.length} characters)`,
    );

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 10);

      if (!text || text.trim().length === 0) {
        throw new Error('No text provided for chunking');
      }

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 20);
      this.logger.debug(`Job ${jobId}: Starting text chunking, progress 20%`);

      // Load workspace settings for chunking strategy
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
        select: ['workspaceId'],
      });
      let chunkingStrategy = 'paragraph';
      if (document?.workspaceId) {
        const settings = await this.workspaceSettingsRepository.findOne({
          where: { workspaceId: document.workspaceId },
          select: ['chunkingStrategy'],
        });
        if (settings?.chunkingStrategy) {
          chunkingStrategy = settings.chunkingStrategy;
        }
      }

      // Chunk the text
      const chunks = this.chunkingService.chunkText(
        text,
        pageCount || undefined,
        chunkingStrategy,
      );

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 40);
      this.logger.debug(`Job ${jobId}: Created ${chunks.length} chunks, progress 40%`);

      // Save chunks to database
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 50);
      this.logger.debug(`Job ${jobId}: Saving chunks to database, progress 50%`);

      const chunkDtos = chunks.map((chunk) => ({
        documentId,
        text: chunk.text,
        pageNumber: chunk.pageNumber,
        paragraphId: chunk.paragraphId,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
      }));

      let createPromise = this.chunkRepository.create(chunkDtos);
      if (signal) {
        createPromise = Promise.race([
          createPromise,
          abortAsPromise(signal),
        ]);
      }
      const savedChunks = await this.withTimeout(
        createPromise,
        60000, // 60 second timeout for saving chunks
        `Failed to save chunks for document ${documentId}`,
      );

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 70);
      this.logger.debug(`Job ${jobId}: Saved ${savedChunks.length} chunks, progress 70%`);

      // Create embeddings job
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 80);
      this.logger.debug(`Job ${jobId}: Creating embeddings job, progress 80%`);

      const embeddingsJob = this.jobRepository.create({
        documentId,
        type: JobType.EMBEDDING,
        status: JobStatus.PENDING,
        metadata: { chunkCount: savedChunks.length },
      });

      const savedEmbeddingsJob = await this.jobRepository.save(embeddingsJob);

      // Add to embeddings queue
      await this.embeddingsQueue.add('embed-chunks', {
        jobId: savedEmbeddingsJob.id,
        documentId,
        chunkIds: savedChunks.map((c) => c.id),
      });

      this.logger.debug(`Job ${jobId}: Embeddings job created: ${savedEmbeddingsJob.id}`);

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
      this.logger.log(`Job ${jobId}: Completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Job ${jobId}: Failed with error: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.updateJobStatus(jobId, JobStatus.FAILED, undefined, errorMessage);
      throw error;
    }
  }
}
