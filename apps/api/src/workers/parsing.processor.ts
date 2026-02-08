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
import { PdfParserService } from '../rag/pdf-parser.service';
import { JurisdictionResolverService } from '../rag/jurisdiction-resolver.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { In } from 'typeorm';
import { OcrService } from '../rag/ocr.service';
import * as fs from 'fs';
import * as path from 'path';

interface ParsingJobData {
  jobId: string;
  documentId: string;
  fileId: string;
  storageKey: string;
  mimeType: string;
}

function writeLog(location: string, message: string, data: any, hypothesisId: string) {
  try {
    // Find workspace root by looking for package.json or node_modules
    let workspaceRoot = process.cwd();
    let currentDir = workspaceRoot;
    let found = false;
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(currentDir, 'package.json')) && 
          fs.existsSync(path.join(currentDir, 'apps'))) {
        workspaceRoot = currentDir;
        found = true;
        break;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break; // Reached filesystem root
      currentDir = parent;
    }
    if (!found) {
      // Fallback: try relative to __dirname
      workspaceRoot = path.resolve(__dirname, '../../../../..');
    }
    const logPath = path.join(workspaceRoot, '.cursor/debug.log');
    // Ensure .cursor directory exists
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logEntry = JSON.stringify({location,message,data,timestamp:Date.now(),hypothesisId,runId:'run1'}) + '\n';
    fs.appendFileSync(logPath, logEntry);
  } catch (e) {
    // Silently fail to avoid breaking the app
    console.error('[writeLog error]', e);
  }
}

@Processor('parsing', {
  stalledInterval: 30000, // Check for stalled jobs every 30s
  maxStalledCount: 1,
})
@Injectable()
export class ParsingProcessor extends WorkerHost {
  private readonly logger = new Logger(ParsingProcessor.name);

  constructor(
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @InjectRepository(DocumentFile)
    private fileRepository: Repository<DocumentFile>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
    private pdfParser: PdfParserService,
    private jurisdictionResolver: JurisdictionResolverService,
    @InjectQueue('chunking')
    private chunkingQueue: Queue,
    @InjectQueue('ocr')
    private ocrQueue: Queue,
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
    // #region agent log
    writeLog('parsing.processor.ts:51', 'updateJobStatus called', {jobId,status,progress,hasError:!!error}, 'E');
    // #endregion
    
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      // #region agent log
      writeLog('parsing.processor.ts:56', 'Job not found in database', {jobId}, 'E');
      // #endregion
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

    // #region agent log
    writeLog('parsing.processor.ts:68', 'Before saving job status', {jobId,status,progress,updatedAt:job.updatedAt}, 'E');
    // #endregion
    
    await this.jobRepository.save(job);
    
    // #region agent log
    writeLog('parsing.processor.ts:71', 'Job status saved successfully', {jobId,status,progress}, 'E');
    // #endregion
    
    const finalProgress = progress !== undefined ? progress : job.progress;
    this.logger.log(`[PROGRESS] Job ${jobId} (${job.type}): status=${status}, progress=${finalProgress}%`);
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

  async process(job: Job<ParsingJobData>): Promise<void> {
    const { jobId, documentId, fileId, storageKey, mimeType } = job.data;

    // #region agent log
    writeLog('parsing.processor.ts:129', 'Parsing processor received job', {jobId,documentId,fileId,storageKey,mimeType}, 'C');
    // #endregion

    this.logger.log(
      `Starting parsing job ${jobId} for file ${fileId} (${mimeType})`,
    );

    try {
      // #region agent log
      writeLog('parsing.processor.ts:137', 'Before first progress update', {jobId}, 'D');
      // #endregion
      
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 10);
      
      // #region agent log
      writeLog('parsing.processor.ts:140', 'First progress update completed', {jobId,progress:10}, 'D');
      // #endregion

      const file = await this.fileRepository.findOne({ where: { id: fileId } });
      if (!file) {
        throw new Error(`File ${fileId} not found`);
      }

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 20);
      this.logger.debug(`Job ${jobId}: File found, progress 20%`);

      let extractedText = '';
      let pageCount = null;

      // Check for unsupported mimeTypes
      if (mimeType !== 'application/pdf' && mimeType !== 'text/plain') {
        const errorMsg = `Unsupported file type: ${mimeType}. Supported types: application/pdf, text/plain`;
        this.logger.error(`Job ${jobId}: ${errorMsg}`);
        await this.updateJobStatus(jobId, JobStatus.FAILED, undefined, errorMsg);
        return;
      }

      // Parse PDF if applicable
      if (mimeType === 'application/pdf') {
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 30);
        this.logger.debug(`Job ${jobId}: Starting PDF parsing, progress 30%`);

        const parsed = await this.withTimeout(
          this.pdfParser.parsePdf(storageKey),
          60000, // 60 second timeout for PDF parsing
          `PDF parsing failed for ${storageKey}`,
        );
        extractedText = parsed.fullText;
        pageCount = parsed.totalPages;

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 40);
        this.logger.debug(`Job ${jobId}: PDF parsed, extracted ${extractedText.length} characters, progress 40%`);

        // Check if PDF is scanned (needs OCR)
        const isScanned = await this.withTimeout(
          this.pdfParser.isScannedPdf(storageKey),
          30000, // 30 second timeout for scanned check
          `Scanned PDF check failed for ${storageKey}`,
        );

        if (isScanned || extractedText.length < 100) {
          // PDF appears to be scanned or has minimal text - trigger OCR
          await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);

          // Create OCR job
          const ocrJob = this.jobRepository.create({
            documentId,
            type: JobType.OCR,
            status: JobStatus.PENDING,
            metadata: { fileId, reason: 'scanned_pdf_detected' },
          });

          const savedOcrJob = await this.jobRepository.save(ocrJob);

          // Add to OCR queue
          await this.ocrQueue.add('ocr-document', {
            jobId: savedOcrJob.id,
            documentId,
            fileId,
            storageKey,
            mimeType,
          });

          // Mark parsing job as completed (OCR will handle the rest)
          return;
        }

        // PDF has extractable text - proceed normally
        file.pageCount = pageCount;
        file.ocrText = extractedText; // Store extracted text
        await this.fileRepository.save(file);

        // Resolve jurisdiction
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 50);
        this.logger.debug(`Job ${jobId}: Resolving jurisdiction, progress 50%`);

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

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 60);
        this.logger.debug(`Job ${jobId}: Jurisdiction resolved, progress 60%`);
      } else if (mimeType === 'text/plain') {
        // For text files, read from storage service
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 30);
        this.logger.debug(`Job ${jobId}: Reading text file, progress 30%`);

        const fileBuffer = await this.withTimeout(
          this.storageService.getFileBuffer(storageKey),
          30000, // 30 second timeout for file read
          `Failed to read file ${storageKey}`,
        );
        extractedText = fileBuffer.toString('utf-8');
        file.ocrText = extractedText;
        await this.fileRepository.save(file);

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 40);
        this.logger.debug(`Job ${jobId}: Text file read, ${extractedText.length} characters, progress 40%`);

        // Resolve jurisdiction for text files too
        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 50);
        this.logger.debug(`Job ${jobId}: Resolving jurisdiction, progress 50%`);

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

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 60);
        this.logger.debug(`Job ${jobId}: Jurisdiction resolved, progress 60%`);
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
      
      // #region agent log
      writeLog('parsing.processor.ts:234', 'Parsing job error caught', {jobId,error:errorMessage,stack:error instanceof Error ? error.stack : undefined}, 'D');
      // #endregion
      
      this.logger.error(
        `Job ${jobId}: Failed with error: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.updateJobStatus(jobId, JobStatus.FAILED, undefined, errorMessage);
      throw error;
    }
  }
}
