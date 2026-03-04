import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { CHUNK_REPOSITORY, IChunkRepository } from '../chunks/chunk-repository.interface';
import { IStorageService } from '../storage/storage.interface';
import { StorageServiceToken } from '../storage/storage.module';
import { RagCacheService } from '../cache/rag-cache.service';

/**
 * Orchestrates document deletion with correct order for future DB separation.
 * 0. Invalidate RAG cache for document
 * 1. Delete chunks (vector DB when separated)
 * 2. Delete files from storage
 * 3. Delete document (relational DB - cascade removes files, jobs, etc.)
 */
@Injectable()
export class DocumentDeletionOrchestrator {
  constructor(
    @Inject(CHUNK_REPOSITORY)
    private chunkRepository: IChunkRepository,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
    private ragCacheService: RagCacheService,
  ) {}

  /**
   * Delete a document and all associated data.
   * Returns true if document was deleted, false if not found.
   */
  async deleteDocument(documentId: string, workspaceId: string): Promise<boolean> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, workspaceId },
      relations: ['files'],
    });

    if (!document) {
      return false;
    }

    // 0. Invalidate RAG cache for this document
    await this.ragCacheService.invalidateDocument(documentId);

    // 1. Delete chunks (vector DB when separated)
    await this.chunkRepository.deleteByDocumentId(documentId);

    // 2. Delete files from storage
    for (const file of document.files) {
      try {
        await this.storageService.deleteFile(file.storageKey);
      } catch (error) {
        // Log error but continue (file may already be deleted)
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to delete file from storage (id: ${file.id}):`, errorMessage);
      }
    }

    // 3. Delete document (cascade removes files, jobs, chat messages, versions from relational DB)
    await this.documentRepository.remove(document);
    return true;
  }
}
