import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { CHUNK_REPOSITORY, IChunkRepository } from '../chunks/chunk-repository.interface';
import { IStorageService } from '../storage/storage.interface';
import { StorageServiceToken } from '../storage/storage.module';
import { RagCacheService } from '../cache/rag-cache.service';
import { MemoryService } from '../memory/memory.service';

/**
 * Orchestrates document deletion with correct order for future DB separation.
 * 0. Invalidate RAG cache for document
 * 1. Delete chunks (vector DB when separated)
 * 2. Delete document-scoped memories (no FK cascade)
 * 3. Delete files from storage
 * 4. Delete document (relational DB - cascade removes files, jobs, etc.)
 */
@Injectable()
export class DocumentDeletionOrchestrator {
  private readonly logger = new Logger(DocumentDeletionOrchestrator.name);

  constructor(
    @Inject(CHUNK_REPOSITORY)
    private chunkRepository: IChunkRepository,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
    private ragCacheService: RagCacheService,
    private memoryService: MemoryService,
  ) {}

  /**
   * Delete a document and all associated data.
   * Returns true if document was deleted, false if not found.
   */
  async deleteDocument(documentId: string, workspaceId: string): Promise<boolean> {
    this.logger.log('[DeleteDocument] Start', { documentId, workspaceId });

    const document = await this.documentRepository.findOne({
      where: { id: documentId, workspaceId },
      relations: ['files'],
    });

    if (!document) {
      this.logger.debug('[DeleteDocument] Document not found, skipping', { documentId });
      return false;
    }

    // 0. Invalidate RAG cache for this document
    await this.ragCacheService.invalidateDocument(documentId);
    this.logger.debug('[DeleteDocument] Step 0: RAG cache invalidated', { documentId });

    // 1. Delete chunks (vector DB when separated)
    await this.chunkRepository.deleteByDocumentId(documentId);
    this.logger.debug('[DeleteDocument] Step 1: Chunks deleted', { documentId });

    // 2. Delete document-scoped memories (no FK cascade)
    await this.memoryService.deleteByDocument(documentId);
    this.logger.debug('[DeleteDocument] Step 2: Memories deleted', { documentId });

    // 3. Delete files from storage
    for (const file of document.files) {
      try {
        await this.storageService.deleteFile(file.storageKey);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('[DeleteDocument] Failed to delete file from storage', {
          fileId: file.id,
          error: errorMessage,
        });
      }
    }
    this.logger.debug('[DeleteDocument] Step 3: Storage files processed', {
      documentId,
      fileCount: document.files.length,
    });

    // 4. Delete document (cascade removes files, jobs, chat messages, versions from relational DB)
    await this.documentRepository.remove(document);
    this.logger.log('[DeleteDocument] Completed', { documentId, workspaceId });
    return true;
  }
}
