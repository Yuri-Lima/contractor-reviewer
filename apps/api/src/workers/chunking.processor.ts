import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, JobStatus, JobType } from '../entities/document-job.entity';
import { Chunk } from '../entities/chunk.entity';
import { ChunkingService } from '../rag/chunking.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface ChunkingJobData {
  jobId: string;
  documentId: string;
  fileId: string;
  text: string;
  pageCount?: number;
}

@Processor('chunking')
@Injectable()
export class ChunkingProcessor extends WorkerHost {
  constructor(
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    private chunkingService: ChunkingService,
    @InjectQueue('embeddings')
    private embeddingsQueue: Queue,
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

    await this.jobRepository.save(job);
  }

  async process(job: Job<ChunkingJobData>): Promise<void> {
    const { jobId, documentId, text, pageCount } = job.data;

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 10);

      // Chunk the text
      const chunks = this.chunkingService.chunkText(text, pageCount || undefined);

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 50);

      // Save chunks to database
      const chunkEntities = chunks.map((chunk) =>
        this.chunkRepository.create({
          documentId,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          paragraphId: chunk.paragraphId,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
        }),
      );

      const savedChunks = await this.chunkRepository.save(chunkEntities);

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 80);

      // Create embeddings job
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

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
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
