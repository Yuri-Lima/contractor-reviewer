import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentJob, JobStatus, JobType } from '../entities/document-job.entity';
import { DocumentFile, FileStatus } from '../entities/document-file.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import { Inject } from '@nestjs/common';
import { StorageServiceToken, IStorageService } from '../storage/storage.module';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ParserFactoryService } from '../parsers/parser-factory.service';
import { DocumentParser, ParsingContext } from '@contractai-review/shared';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';
import { JobProgressPublisher } from './job-progress.publisher';
import { abortAsPromise } from '../common/utils/abort-promise';
interface ParsingJobData {
  jobId: string;
  documentId: string;
  fileId: string;
  storageKey: string;
  mimeType: string;
  parser?: string;
  workspaceId?: string;
}

@Processor('parsing', {
  stalledInterval: 30000,
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
    private parserFactory: ParserFactoryService,
    private workspaceSettingsService: WorkspaceSettingsService,
    @InjectQueue('chunking')
    private chunkingQueue: Queue,
    @InjectQueue('jurisdiction-evaluation')
    private jurisdictionEvaluationQueue: Queue,
    private jobProgressPublisher: JobProgressPublisher,
  ) {
    super();
  }

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
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.status = status;
    if (progress !== undefined) job.progress = progress;
    if (error) {
      job.lastError = error;
      job.attempts += 1;
    }
    job.updatedAt = new Date();
    await this.jobRepository.save(job);
    this.logger.log(`[PROGRESS] Job ${jobId} (${job.type}): status=${status}, progress=${progress ?? job.progress}%`);
    this.jobProgressPublisher.publish(job.documentId, job).catch(() => {});
  }

  private async markFileAvailable(
    fileId: string,
    parsedBy?: string,
    parsingContext?: ParsingContext | null,
  ): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['document'],
    });
    if (!file) throw new Error(`File ${fileId} not found`);

    file.status = FileStatus.AVAILABLE;
    if (parsedBy) file.parsedBy = parsedBy;
    if (parsingContext !== undefined) {
      file.parsingContext = parsingContext;
    }
    await this.fileRepository.save(file);
    await this.updateDocumentStatusIfReady(file.documentId);
  }

  private async updateDocumentStatusIfReady(documentId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['files'],
    });
    if (!document) return;

    const allFilesReady = document.files.every(
      (f) => f.status === FileStatus.AVAILABLE || f.status === FileStatus.ERROR,
    );
    if (allFilesReady && document.files.some((f) => f.status === FileStatus.AVAILABLE)) {
      document.status = DocumentStatus.AVAILABLE;
      await this.documentRepository.save(document);
      await this.jurisdictionEvaluationQueue.add('evaluate', {
        documentId,
        workspaceId: document.workspaceId,
      });
    }
  }

  async process(
    job: Job<ParsingJobData>,
    _token?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { jobId, documentId, fileId, storageKey, mimeType, parser: parserParam, workspaceId: jobWorkspaceId } = job.data;

    this.logger.log(`Starting parsing job ${jobId} for file ${fileId} (${mimeType})`);

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 10);

      const file = await this.fileRepository.findOne({ where: { id: fileId } });
      if (!file) throw new Error(`File ${fileId} not found`);

      const document = await this.documentRepository.findOne({ where: { id: documentId } });
      if (!document) throw new Error(`Document ${documentId} not found`);

      const workspaceId = jobWorkspaceId ?? document.workspaceId;

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 20);

      let extractedText = '';
      let pageCount: number | null = null;
      let usedParser: string | undefined;

      if (['text/plain', 'text/markdown', 'text/x-markdown'].includes(mimeType)) {
        let bufferPromise: Promise<Buffer> = this.storageService.getFileBuffer(
          storageKey,
          signal ? { signal } : undefined,
        );
        if (signal) {
          bufferPromise = Promise.race([
            bufferPromise,
            abortAsPromise(signal),
          ]);
        }
        const fileBuffer = await this.withTimeout(
          bufferPromise,
          30000,
          `Failed to read file ${storageKey}`,
        );
        extractedText = fileBuffer.toString('utf-8');
        file.ocrText = extractedText;
        file.parsingContext = {
          parserId: 'direct',
          exportFormat: 'plain',
        };
        await this.fileRepository.save(file);
        usedParser = 'direct';
      } else {
        const preferredId = (parserParam as DocumentParser) ?? await this.getDefaultParser(workspaceId);
        const { adapter, options, parserId } = await this.parserFactory.getParserWithFallback(
          mimeType,
          preferredId,
          workspaceId,
        );

        await this.updateJobStatus(jobId, JobStatus.PROCESSING, 30);

        let bufferPromise: Promise<Buffer> = this.storageService.getFileBuffer(
          storageKey,
          signal ? { signal } : undefined,
        );
        if (signal) {
          bufferPromise = Promise.race([
            bufferPromise,
            abortAsPromise(signal),
          ]);
        }
        const fileBuffer = await this.withTimeout(
          bufferPromise,
          30000,
          `Failed to read file ${storageKey}`,
        );

        const result = await adapter.parse(fileBuffer, mimeType, {
          ...options,
          signal,
        });
        extractedText = result.markdown ?? '';
        pageCount = result.pageCount ?? null;
        usedParser = parserId;

        file.ocrText = extractedText;
        if (pageCount != null) file.pageCount = pageCount;
        file.parsedBy = usedParser;
        file.parsingContext = result.parserContext
          ? result.parserContext
          : ({
              parserId: usedParser,
              pageCount: pageCount ?? undefined,
              exportFormat: 'markdown',
            });
        await this.fileRepository.save(file);
      }

      await this.updateJobStatus(jobId, JobStatus.PROCESSING, 80);

      if (extractedText) {
        this.logger.log(`[Parsing] Branch: chunking (text extracted), jobId=${jobId}`);
        const chunkingJob = this.jobRepository.create({
          documentId,
          type: JobType.CHUNKING,
          status: JobStatus.PENDING,
          metadata: { fileId, extractedText: extractedText.substring(0, 100) },
        });
        const savedChunkingJob = await this.jobRepository.save(chunkingJob);
        await this.chunkingQueue.add('chunk-document', {
          jobId: savedChunkingJob.id,
          documentId,
          fileId,
          text: extractedText,
          pageCount,
        });
      } else {
        this.logger.log(`[Parsing] Branch: skip (no text extracted), jobId=${jobId}`);
        this.logger.warn(`Job ${jobId}: No text extracted, skipping chunking`);
      }

      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100);
      const fileToMark = await this.fileRepository.findOne({ where: { id: fileId } });
      await this.markFileAvailable(
        fileId,
        usedParser,
        fileToMark?.parsingContext ?? undefined,
      );
      this.logger.log(`Job ${jobId}: Completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const parserUsed = parserParam ?? 'default';
      this.logger.error(
        `Parsing failed [parser=${parserUsed}] Job ${jobId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.updateJobStatus(jobId, JobStatus.FAILED, undefined, errorMessage);
      throw error;
    }
  }

  private async getDefaultParser(workspaceId: string): Promise<DocumentParser> {
    const settings = await this.workspaceSettingsService.getSettings(workspaceId);
    const parser = settings.documentProcessing?.defaultDocumentParser ?? 'docling';
    return parser as DocumentParser;
  }
}
