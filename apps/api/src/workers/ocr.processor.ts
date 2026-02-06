import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, JobStatus, JobType } from '../entities/document-job.entity';
import { DocumentFile, FileStatus } from '../entities/document-file.entity';
import { Document, DocumentStatus, JurisdictionStatus } from '../entities/document.entity';
import { Inject } from '@nestjs/common';
import { StorageServiceToken, IStorageService } from '../storage/storage.module';
import { OcrService } from '../rag/ocr.service';
import { JurisdictionResolverService } from '../rag/jurisdiction-resolver.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface OcrJobData {
  jobId: string;
  documentId: string;
  fileId: string;
  storageKey: string;
  mimeType: string;
}

@Processor('ocr')
@Injectable()
export class OcrProcessor extends WorkerHost {
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

  async process(job: Job<OcrJobData>): Promise<void> {
    const { jobId, documentId, fileId, storageKey, mimeType } = job.data;

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 10);

      const file = await this.fileRepository.findOne({ where: { id: fileId } });
      if (!file) {
        throw new Error(`File ${fileId} not found`);
      }

      let extractedText = '';
      let pageCount = null;

      // Process PDF with OCR
      if (mimeType === 'application/pdf') {
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 20);

        // Extract text using OCR
        const ocrResult = await this.ocrService.extractTextFromPdf(storageKey);
        extractedText = ocrResult.fullText;
        pageCount = ocrResult.totalPages;

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 70);

        file.pageCount = pageCount;
        file.ocrText = extractedText; // Store OCR extracted text
        await this.fileRepository.save(file);

        // Resolve jurisdiction
        const document = await this.documentRepository.findOne({
          where: { id: documentId },
        });

        if (document && extractedText) {
          const jurisdictionResult =
            await this.jurisdictionResolver.resolveJurisdiction(extractedText);

          if (jurisdictionResult.jurisdiction) {
            document.resolvedJurisdiction = jurisdictionResult.jurisdiction;
            document.jurisdictionStatus = jurisdictionResult.status as JurisdictionStatus;
            await this.documentRepository.save(document);
          }
        }
      } else {
        throw new Error(`OCR not supported for mime type: ${mimeType}`);
      }

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 80);

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
      }

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
      await this.markFileAvailable(fileId);
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
