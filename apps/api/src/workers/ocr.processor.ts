import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, JobStatus, JobType } from '../entities/document-job.entity';
import { DocumentFile, FileStatus } from '../entities/document-file.entity';
import { Document, DocumentStatus, JurisdictionStatus } from '../entities/document.entity';
import { Inject } from '@nestjs/common';
import { StorageServiceToken, IStorageService } from '../storage/storage.module';
import { OcrService } from '../rag/ocr.service';
import { JurisdictionResolverService } from '../rag/jurisdiction-resolver.service';
import { JobProgressPublisher } from './job-progress.publisher';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { abortAsPromise } from '../common/utils/abort-promise';

interface OcrJobData {
  jobId: string;
  documentId: string;
  fileId: string;
  storageKey: string;
  mimeType: string;
}

@Processor('ocr', {
  stalledInterval: 60000, // OCR jobs take longer, check every 60s
  maxStalledCount: 1,
})
@Injectable()
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @InjectRepository(DocumentFile)
    private fileRepository: Repository<DocumentFile>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
    private ocrService: OcrService,
    private jurisdictionResolver: JurisdictionResolverService,
    @InjectQueue('chunking')
    private chunkingQueue: Queue,
    private jobProgressPublisher: JobProgressPublisher,
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
    
    const finalProgress = progress !== undefined ? progress : job.progress;
    this.logger.log(`[PROGRESS] Job ${jobId} (${job.type}): status=${status}, progress=${finalProgress}%`);
    this.jobProgressPublisher.publish(job.documentId, job).catch(() => {});
  }

  private async markFileAvailable(fileId: string): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['document'],
    });

    if (!file) {
      throw new Error(`File ${fileId} not found`);
    }

    file.status = FileStatus.AVAILABLE;
    await this.fileRepository.save(file);

    // Update document status if all files are available
    await this.updateDocumentStatusIfReady(file.documentId);
  }

  private async updateDocumentStatusIfReady(documentId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['files'],
    });

    if (!document) {
      return;
    }

    const allFilesReady = document.files.every(
      (f) => f.status === FileStatus.AVAILABLE || f.status === FileStatus.ERROR,
    );

    if (allFilesReady && document.files.some((f) => f.status === FileStatus.AVAILABLE)) {
      document.status = DocumentStatus.AVAILABLE;
      await this.documentRepository.save(document);
    }
  }

  async process(
    job: Job<OcrJobData>,
    _token?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { jobId, documentId, fileId, storageKey, mimeType } = job.data;

    this.logger.log(
      `Starting OCR job ${jobId} for file ${fileId} (${mimeType})`,
    );

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 10);

      const file = await this.fileRepository.findOne({ where: { id: fileId } });
      if (!file) {
        throw new Error(`File ${fileId} not found`);
      }

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 20);
      this.logger.debug(`Job ${jobId}: File found, progress 20%`);

      let extractedText = '';
      let pageCount = null;

      // Process PDF with OCR
      if (mimeType === 'application/pdf') {
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 30);
        this.logger.debug(`Job ${jobId}: Starting OCR processing, progress 30%`);

        // Extract text using OCR (best-effort cancellation via signal)
        let ocrPromise = this.ocrService.extractTextFromPdf(storageKey, {
          signal,
        });
        if (signal) {
          ocrPromise = Promise.race([
            ocrPromise,
            abortAsPromise(signal),
          ]);
        }
        const ocrResult = await this.withTimeout(
          ocrPromise,
          300000, // 5 minute timeout for OCR (it's slow)
          `OCR processing failed for ${storageKey}`,
        );
        extractedText = ocrResult.fullText;
        pageCount = ocrResult.totalPages;

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 70);
        this.logger.debug(
          `Job ${jobId}: OCR completed, extracted ${extractedText.length} characters, progress 70%`,
        );

        file.pageCount = pageCount;
        file.ocrText = extractedText; // Store OCR extracted text
        await this.fileRepository.save(file);

        // Resolve jurisdiction
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 75);
        this.logger.debug(`Job ${jobId}: Resolving jurisdiction, progress 75%`);

        const document = await this.documentRepository.findOne({
          where: { id: documentId },
        });

        if (document && extractedText) {
          const jurisdictionResult = await this.withTimeout(
            this.jurisdictionResolver.resolveJurisdiction(extractedText),
            30000, // 30 second timeout for jurisdiction resolution
            `Jurisdiction resolution failed for document ${documentId}`,
          );

          if (jurisdictionResult.jurisdiction) {
            document.resolvedJurisdiction = jurisdictionResult.jurisdiction;
            document.jurisdictionStatus = jurisdictionResult.status as JurisdictionStatus;
            await this.documentRepository.save(document);
            this.logger.debug(
              `Job ${jobId}: Resolved jurisdiction: ${jurisdictionResult.jurisdiction}`,
            );
          }
        }
      } else {
        const errorMsg = `OCR not supported for mime type: ${mimeType}. Only application/pdf is supported.`;
        this.logger.error(`Job ${jobId}: ${errorMsg}`);
        await this.updateJobStatus(jobId, JobStatus.FAILED, undefined, errorMsg);
        return;
      }

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 80);
      this.logger.debug(`Job ${jobId}: Creating chunking job, progress 80%`);

      // Create chunking job if text was extracted
      if (extractedText) {
        const chunkingJob = this.jobRepository.create({
          documentId,
          type: JobType.CHUNKING,
          status: JobStatus.PENDING,
          metadata: { fileId, extractedText: extractedText.substring(0, 100) },
        });

        const savedChunkingJob = await this.jobRepository.save(chunkingJob);

        // Add to chunking queue
        await this.chunkingQueue.add('chunk-document', {
          jobId: savedChunkingJob.id,
          documentId,
          fileId,
          text: extractedText,
          pageCount,
        });

        this.logger.debug(`Job ${jobId}: Chunking job created: ${savedChunkingJob.id}`);
      } else {
        this.logger.warn(`Job ${jobId}: No text extracted, skipping chunking job`);
      }

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
      await this.markFileAvailable(fileId);
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
