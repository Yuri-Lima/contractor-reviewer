import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from '../entities/document.entity';
import { DocumentFile, FileStatus } from '../entities/document-file.entity';
import { DocumentJob, JobType, JobStatus } from '../entities/document-job.entity';
import { Chunk } from '../entities/chunk.entity';
import { Inject } from '@nestjs/common';
import { StorageServiceToken, IStorageService } from '../storage/storage.module';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';

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

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentFile)
    private documentFileRepository: Repository<DocumentFile>,
    @InjectRepository(DocumentJob)
    private documentJobRepository: Repository<DocumentJob>,
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
    @InjectQueue('parsing')
    private parsingQueue: Queue,
  ) {}

  /**
   * Create a new document
   */
  async create(
    workspaceId: string,
    title: string,
    description?: string,
  ): Promise<Document> {
    const document = this.documentRepository.create({
      workspaceId,
      title,
      description,
      status: DocumentStatus.PROCESSING,
    });

    return this.documentRepository.save(document);
  }

  /**
   * Get all documents for a workspace
   */
  async findAll(workspaceId: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: { workspaceId },
      relations: ['files', 'jobs'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get document by ID (with workspace filter)
   */
  async findById(documentId: string, workspaceId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, workspaceId },
      relations: ['files', 'jobs'],
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return document;
  }

  /**
   * Update document (title, description). Only provided fields are updated.
   */
  async update(
    documentId: string,
    workspaceId: string,
    data: { title?: string; description?: string },
  ): Promise<Document> {
    const document = await this.findById(documentId, workspaceId);
    if (data.title !== undefined) {
      const trimmed = data.title.trim();
      if (!trimmed) {
        throw new BadRequestException('Document title cannot be empty');
      }
      document.title = trimmed;
    }
    if (data.description !== undefined) {
      document.description = data.description?.trim() ?? '';
    }
    return this.documentRepository.save(document);
  }

  /**
   * Upload file to document
   */
  async uploadFile(
    documentId: string,
    workspaceId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    parser?: string,
  ): Promise<DocumentFile> {
    // Verify document exists and belongs to workspace
    const document = await this.findById(documentId, workspaceId);

    // Upload to storage
    const storageKey = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      workspaceId,
      documentId,
    );

    // Create file record
    const documentFile = this.documentFileRepository.create({
      documentId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey,
      status: FileStatus.PROCESSING,
    });

    const savedFile = await this.documentFileRepository.save(documentFile);

    // Create parsing job
    await this.createJob(documentId, JobType.PARSING, {
      fileId: savedFile.id,
      storageKey,
      mimeType: file.mimetype,
      parser,
      workspaceId,
    });

    return savedFile;
  }

  /**
   * Create a job for document processing
   */
  async createJob(
    documentId: string,
    type: JobType,
    metadata?: Record<string, any>,
  ): Promise<DocumentJob> {
    const job = this.documentJobRepository.create({
      documentId,
      type,
      status: JobStatus.PENDING,
      metadata,
    });

    const savedJob = await this.documentJobRepository.save(job);

    // Add to queue
    await this.addToQueue(type, {
      jobId: savedJob.id,
      documentId,
      ...metadata,
    });

    return savedJob;
  }

  /**
   * Add job to appropriate queue
   */
  private async addToQueue(type: JobType, data: any): Promise<void> {
    // #region agent log
    writeLog('documents.service.ts:149', 'Adding job to queue', {type,data:JSON.stringify(data)}, 'C');
    // #endregion
    
    switch (type) {
      case JobType.PARSING:
        try {
          await this.parsingQueue.add('parse-document', data);
          // #region agent log
          writeLog('documents.service.ts:153', 'Parsing job added to queue successfully', {jobId:data.jobId}, 'C');
          // #endregion
        } catch (error) {
          // #region agent log
          writeLog('documents.service.ts:156', 'Failed to add parsing job to queue', {error:error instanceof Error ? error.message : String(error),jobId:data.jobId}, 'B');
          // #endregion
          throw error;
        }
        break;
      // Other queues will be added as needed
    }
  }

  /**
   * Get all jobs for a document
   */
  async getDocumentJobs(documentId: string): Promise<DocumentJob[]> {
    // #region agent log
    writeLog('documents.service.ts:197', 'getDocumentJobs called', {documentId}, 'F');
    // #endregion
    
    const jobs = await this.documentJobRepository.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
    
    // Check for stuck jobs (pending/processing jobs older than 30 seconds with no progress updates)
    const now = new Date();
    const stuckJobs = jobs.filter(j => 
      (j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING) &&
      j.updatedAt && 
      (now.getTime() - j.updatedAt.getTime()) > 30000 // 30 seconds
    );
    
    if (stuckJobs.length > 0) {
      // #region agent log
      writeLog('documents.service.ts:220', 'Stuck jobs detected - worker may not be running', {
        documentId,
        stuckJobCount: stuckJobs.length,
        stuckJobs: stuckJobs.map(j => ({id: j.id, type: j.type, status: j.status, progress: j.progress, updatedAt: j.updatedAt}))
      }, 'F');
      // #endregion
    }
    
    // #region agent log
    writeLog('documents.service.ts:204', 'getDocumentJobs returning', {
      documentId,
      jobCount: jobs.length,
      activeJobs: jobs.filter(j => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING).length,
      jobs: jobs.map(j => ({id: j.id, type: j.type, status: j.status, progress: j.progress, updatedAt: j.updatedAt}))
    }, 'F');
    // #endregion
    
    // Log progress values for active jobs
    const activeJobs = jobs.filter(j => j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING);
    if (activeJobs.length > 0) {
      console.log(`[API] Returning ${activeJobs.length} active jobs with progress:`, 
        activeJobs.map(j => `${j.type}=${j.progress}%`).join(', '));
    }
    
    return jobs;
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress?: number,
    error?: string,
  ): Promise<DocumentJob> {
    const job = await this.documentJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    job.status = status;
    if (progress !== undefined) {
      job.progress = progress;
    }
    if (error) {
      job.lastError = error;
      job.attempts += 1;
    }

    return this.documentJobRepository.save(job);
  }

  /**
   * Mark file as available after processing
   */
  async markFileAvailable(fileId: string): Promise<DocumentFile> {
    const file = await this.documentFileRepository.findOne({
      where: { id: fileId },
      relations: ['document'],
    });

    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    file.status = FileStatus.AVAILABLE;
    const savedFile = await this.documentFileRepository.save(file);

    // Update document status if all files are available
    await this.updateDocumentStatusIfReady(file.documentId);

    return savedFile;
  }

  /**
   * Update document status to AVAILABLE if all files are processed
   */
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

  /**
   * Get file by ID (with workspace and document validation)
   */
  async getFile(fileId: string, documentId: string, workspaceId: string): Promise<DocumentFile> {
    // Verify document exists and belongs to workspace
    await this.findById(documentId, workspaceId);

    const file = await this.documentFileRepository.findOne({
      where: { id: fileId, documentId },
    });

    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    return file;
  }

  /**
   * Get extracted content for a single file (ocrText).
   * Returns empty content when file is not yet processed.
   */
  async getFileContent(
    fileId: string,
    documentId: string,
    workspaceId: string,
  ): Promise<{ content: string; fileName: string; parsedBy?: string }> {
    const file = await this.getFile(fileId, documentId, workspaceId);
    return {
      content: file.ocrText ?? '',
      fileName: file.fileName,
      parsedBy: file.parsedBy ?? undefined,
    };
  }

  /**
   * Get download URL for a file
   */
  async getFileDownloadUrl(storageKey: string, expiresIn?: number): Promise<string> {
    return await this.storageService.getFileUrl(storageKey, expiresIn || 3600); // Default 1 hour
  }

  /**
   * Get file buffer from storage
   */
  async getFileBuffer(storageKey: string): Promise<Buffer> {
    return await this.storageService.getFileBuffer(storageKey);
  }

  /**
   * Get paginated files for a document with filtering, sorting, and pagination.
   * Supports general fuzzy search (q) via pg_trgm and column-specific filters.
   */
  async getDocumentFilesPaginated(
    documentId: string,
    query: {
      offset?: number;
      limit?: number;
      sortField?: string;
      sortOrder?: number;
      q?: string;
      fileName?: string;
      mimeType?: string;
      status?: string;
      searchMode?: 'fuzzy' | 'contains';
      similarityThreshold?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{ files: DocumentFile[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(query.limit || 25, 100);
    const offset = query.offset || 0;
    const rawThreshold = query.similarityThreshold;
    const parsedThreshold =
      typeof rawThreshold === 'string' ? parseFloat(rawThreshold) : rawThreshold;
    const threshold = Math.max(0, Math.min(1, parsedThreshold ?? 0.2));
    const searchMode = query.searchMode ?? 'fuzzy';

    const has = (v: string | number | undefined): v is string | number =>
      v != null && v !== '' && String(v) !== 'undefined';

    const qb = this.documentFileRepository
      .createQueryBuilder('file')
      .select([
        'file.id',
        'file.documentId',
        'file.fileName',
        'file.mimeType',
        'file.sizeBytes',
        'file.status',
        'file.storageKey',
        'file.errorMessage',
        'file.pageCount',
        'file.parsedBy',
        'file.createdAt',
        'file.updatedAt',
      ])
      .where('file.documentId = :documentId', { documentId })
      .take(limit)
      .skip(offset);

    const useFuzzy = (q: string) => searchMode === 'fuzzy' && q.length >= 3;

    // General search (q) - fuzzy across fileName, mimeType, status
    if (has(query.q)) {
      const q = String(query.q).trim();
      if (useFuzzy(q)) {
        try {
          qb.andWhere(
            `(similarity(file."fileName", :q) > :t OR similarity(file."mimeType", :q) > :t OR similarity(file."status"::text, :q) > :t)`,
            { q, t: threshold },
          );
          qb.addOrderBy(
            `GREATEST(COALESCE(similarity(file."fileName", :q), 0), COALESCE(similarity(file."mimeType", :q), 0), COALESCE(similarity(file."status"::text, :q), 0))`,
            'DESC',
          );
        } catch (err) {
          // Fallback to ILIKE if pg_trgm fails
          console.warn('pg_trgm fuzzy search failed, falling back to ILIKE', err);
          qb.andWhere(
            `(file."fileName" ILIKE :qPattern OR file."mimeType" ILIKE :qPattern OR file."status"::text ILIKE :qPattern)`,
            { qPattern: `%${q}%` },
          );
        }
      } else {
        const pattern = `%${q}%`;
        qb.andWhere(
          `(file."fileName" ILIKE :qPattern OR file."mimeType" ILIKE :qPattern OR file."status"::text ILIKE :qPattern)`,
          { qPattern: pattern },
        );
      }
    } else {
      // Column-specific filters
      if (has(query.fileName)) {
        const val = String(query.fileName).trim();
        if (useFuzzy(val)) {
          try {
            qb.andWhere('similarity(file."fileName", :fileName) > :t', {
              fileName: val,
              t: threshold,
            });
            qb.addOrderBy('similarity(file."fileName", :fileName)', 'DESC');
          } catch (err) {
            console.warn('pg_trgm fileName fuzzy failed, falling back to ILIKE', err);
            qb.andWhere('file."fileName" ILIKE :fileName', { fileName: `%${val}%` });
          }
        } else {
          qb.andWhere('file."fileName" ILIKE :fileName', { fileName: `%${val}%` });
        }
      }
      if (has(query.mimeType)) {
        qb.andWhere('file."mimeType" = :mimeType', { mimeType: query.mimeType });
      }
      if (has(query.status)) {
        qb.andWhere('file."status" = :status', { status: query.status });
      }
    }

    // Date range filter (createdAt)
    if (has(query.startDate) && has(query.endDate)) {
      const startDate = new Date(String(query.startDate) + 'T00:00:00.000Z');
      const endDate = new Date(String(query.endDate) + 'T23:59:59.999Z');
      qb.andWhere('file.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (has(query.startDate)) {
      const startDate = new Date(String(query.startDate) + 'T00:00:00.000Z');
      qb.andWhere('file.createdAt >= :startDate', { startDate });
    } else if (has(query.endDate)) {
      const endDate = new Date(String(query.endDate) + 'T23:59:59.999Z');
      qb.andWhere('file.createdAt <= :endDate', { endDate });
    }

    // Sort: only apply default sort if no fuzzy ordering was added
    if (has(query.sortField) && !has(query.q) && !(has(query.fileName) && useFuzzy(String(query.fileName)))) {
      const order = query.sortOrder === -1 ? 'DESC' : 'ASC';
      qb.orderBy(`file.${query.sortField}`, order);
    } else if (!has(query.q) && !(has(query.fileName) && useFuzzy(String(query.fileName)))) {
      qb.orderBy('file.createdAt', 'DESC');
    }

    const [files, total] = await qb.getManyAndCount();

    return { files, total, limit, offset };
  }

  /**
   * Get original text from document chunks
   */
  async getOriginalText(documentId: string, workspaceId: string): Promise<string> {
    // Verify document exists and belongs to workspace
    await this.findById(documentId, workspaceId);

    // Get all chunks for the document, ordered by pageNumber and startIndex
    const chunks = await this.chunkRepository.find({
      where: { documentId },
      order: {
        pageNumber: 'ASC',
        startIndex: 'ASC',
      },
    });

    // Concatenate text from all chunks
    return chunks.map((chunk) => chunk.text).join('\n\n');
  }

  /**
   * Delete a single file from a document (hard delete)
   * Deletes from storage, removes file record, and removes jobs associated with this file
   */
  async deleteFile(
    documentId: string,
    fileId: string,
    workspaceId: string,
  ): Promise<{ fileName: string }> {
    await this.findById(documentId, workspaceId);
    const file = await this.documentFileRepository.findOne({
      where: { id: fileId, documentId },
    });
    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }
    const fileName = file.fileName;

    try {
      await this.storageService.deleteFile(file.storageKey);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to delete file from storage (id: ${fileId}):`, errorMessage);
    }

    await this.documentJobRepository
      .createQueryBuilder()
      .delete()
      .where('documentId = :documentId', { documentId })
      .andWhere("metadata->>'fileId' = :fileId", { fileId })
      .execute();

    await this.documentFileRepository.remove(file);
    return { fileName };
  }

  /**
   * Delete document (hard delete - idempotent)
   * Returns true if document was deleted, false if it didn't exist
   */
  async delete(documentId: string, workspaceId: string): Promise<boolean> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, workspaceId },
      relations: ['files', 'chunks'],
    });

    // Idempotent: if document doesn't exist, return false (already deleted)
    if (!document) {
      return false;
    }

    // Delete files from storage
    for (const file of document.files) {
      try {
        await this.storageService.deleteFile(file.storageKey);
      } catch (error) {
        // Log error but continue (file may already be deleted)
        // Never log file content or storage keys with sensitive data
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to delete file (id: ${file.id}):`, errorMessage);
      }
    }

    // Delete chunks (embeddings are in chunks table)
    if (document.chunks && document.chunks.length > 0) {
      await this.chunkRepository.remove(document.chunks);
    }

    // Delete document (cascade will delete files and jobs)
    await this.documentRepository.remove(document);
    return true;
  }
}
