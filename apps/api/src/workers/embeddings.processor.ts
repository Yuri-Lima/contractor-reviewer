import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DocumentJob, JobStatus } from '../entities/document-job.entity';
import { Chunk } from '../entities/chunk.entity';
import { EmbeddingsService } from '../rag/embeddings.service';

interface EmbeddingsJobData {
  jobId: string;
  documentId: string;
  chunkIds: string[];
}

@Processor('embeddings')
@Injectable()
export class EmbeddingsProcessor extends WorkerHost {
  constructor(
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    private embeddingsService: EmbeddingsService,
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

  async process(job: Job<EmbeddingsJobData>): Promise<void> {
    const { jobId, chunkIds } = job.data;

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 0);

      // Load chunks
      const chunks = await this.chunkRepository.find({
        where: { id: In(chunkIds) },
      });

      if (chunks.length === 0) {
        throw new Error('No chunks found');
      }

      // Filter chunks that don't have embeddings yet
      const chunksToEmbed = chunks.filter((c) => !c.embedding);

      if (chunksToEmbed.length === 0) {
        await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
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

        // Generate embeddings
        const embeddings = await this.embeddingsService.generateEmbeddings(texts);

        // Update chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = embeddings[j];
        }

        await this.chunkRepository.save(batch);
        processed += batch.length;
      }

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
