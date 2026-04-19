import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentFile } from '../entities/document-file.entity';
import { Document } from '../entities/document.entity';
import { ChatThread } from '../entities/chat-thread.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { Memory } from '../entities/memory.entity';
import { CHUNK_REPOSITORY, IChunkRepository } from '../chunks/chunk-repository.interface';
import { RetentionService } from './retention.service';
import { IStorageService } from '../storage/storage.interface';
import { StorageServiceToken } from '../storage/storage.module';

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    @InjectRepository(DocumentFile)
    private fileRepository: Repository<DocumentFile>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @Inject(CHUNK_REPOSITORY)
    private chunkRepository: IChunkRepository,
    @InjectRepository(ChatThread)
    private chatThreadRepository: Repository<ChatThread>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
    @InjectRepository(Memory)
    private memoryRepository: Repository<Memory>,
    private retentionService: RetentionService,
    @Inject(StorageServiceToken)
    private storageService: IStorageService,
  ) {}

  /**
   * Purge expired files (hard delete from storage and database)
   */
  async purgeExpiredFiles(): Promise<{ deleted: number; errors: number }> {
    this.logger.log('Starting purge of expired files...');
    let deleted = 0;
    let errors = 0;

    try {
      // Get all files
      const files = await this.fileRepository.find({
        relations: ['document'],
      });

      for (const file of files) {
        try {
          const isExpired = await this.retentionService.isFileExpired(
            file.document.workspaceId,
            file.createdAt,
          );

          if (isExpired) {
            // Delete from storage
            try {
              await this.storageService.deleteFile(file.storageKey);
            } catch (error) {
              this.logger.warn(`Failed to delete file from storage: ${file.storageKey}`, error);
            }

            // Delete from database (CASCADE will handle chunks)
            await this.fileRepository.remove(file);
            deleted++;
            this.logger.debug(`Purged expired file: ${file.id} (${file.fileName})`);
          }
        } catch (error) {
          errors++;
          this.logger.error(`Error purging file ${file.id}:`, error);
        }
      }

      this.logger.log(`Purge completed: ${deleted} files deleted, ${errors} errors`);
      return { deleted, errors };
    } catch (error) {
      this.logger.error('Error during file purge:', error);
      throw error;
    }
  }

  /**
   * Purge expired text and embeddings (chunks)
   */
  async purgeExpiredTextAndEmbeddings(): Promise<{ deleted: number; errors: number }> {
    this.logger.log('Starting purge of expired text/embeddings...');
    let deleted = 0;
    let errors = 0;

    try {
      // Load documents (no chunks relation - use ChunkRepository abstraction)
      const documents = await this.documentRepository.find({
        select: ['id', 'workspaceId', 'createdAt'],
      });

      for (const document of documents) {
        try {
          const isExpired = await this.retentionService.isTextExpired(
            document.workspaceId,
            document.createdAt,
          );

          if (isExpired) {
            const count = await this.chunkRepository.deleteByDocumentId(document.id);
            deleted += count;
            if (count > 0) {
              this.logger.debug(
                `Purged ${count} chunks for expired document: ${document.id}`,
              );
            }
          }
        } catch (error) {
          errors++;
          this.logger.error(`Error purging text/embeddings for document ${document.id}:`, error);
        }
      }

      this.logger.log(
        `Purge completed: ${deleted} chunks deleted, ${errors} errors`,
      );
      return { deleted, errors };
    } catch (error) {
      this.logger.error('Error during text/embeddings purge:', error);
      throw error;
    }
  }

  /**
   * Purge expired chat messages.
   * 1) No-logs accelerated purge (when skipChatMessages enabled)
   * 2) Retention-based purge for all workspaces (messages older than text retention)
   * 3) Purge empty threads after message purge
   */
  async purgeExpiredChatMessages(): Promise<{
    chatMessages: number;
    emptyThreads: number;
    errors: number;
  }> {
    this.logger.log('Starting purge of expired chat messages...');
    let chatMessagesDeleted = 0;
    let emptyThreadsDeleted = 0;
    let errors = 0;

    try {
      // 1) No-logs accelerated purge
      const workspacesWithNoLogs = await this.settingsRepository.find({
        where: { noLogsEnabled: true },
      });

      for (const settings of workspacesWithNoLogs) {
        try {
          const acceleratedPurgeDays = settings.noLogsConfig?.acceleratedPurgeDays || 1;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - acceleratedPurgeDays);

          if (settings.noLogsConfig?.skipChatMessages) {
            const chatMessages = await this.chatMessageRepository.find({
              where: { workspaceId: settings.workspaceId },
            });

            const expiredChatMessages = chatMessages.filter(
              (msg) => msg.createdAt < cutoffDate,
            );

            if (expiredChatMessages.length > 0) {
              await this.chatMessageRepository.remove(expiredChatMessages);
              chatMessagesDeleted += expiredChatMessages.length;
              this.logger.debug(
                `Purged ${expiredChatMessages.length} chat messages (no-logs) for workspace ${settings.workspaceId}`,
              );
            }
          }
        } catch (error) {
          errors++;
          this.logger.error(
            `Error purging chat for workspace ${settings.workspaceId}:`,
            error,
          );
        }
      }

      // 2) Retention-based chat purge for workspaces that have chat messages
      const workspaceIdsFromMessages = await this.chatMessageRepository
        .createQueryBuilder('m')
        .select('DISTINCT m.workspaceId')
        .getRawMany<{ workspaceId: string }>();

      for (const { workspaceId } of workspaceIdsFromMessages) {
        try {
          const config = await this.retentionService.getRetentionConfig(
            workspaceId,
          );
          const retentionDays =
            config.retentionOverrides?.['text'] ||
            config.defaultTextEmbeddingsRetentionDays;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

          const chatMessages = await this.chatMessageRepository.find({
            where: { workspaceId },
          });

          const expired = chatMessages.filter((msg) => msg.createdAt < cutoffDate);

          if (expired.length > 0) {
            await this.chatMessageRepository.remove(expired);
            chatMessagesDeleted += expired.length;
            this.logger.debug(
              `Purged ${expired.length} chat messages (retention) for workspace ${workspaceId}`,
            );
          }
        } catch (error) {
          errors++;
          this.logger.error(
            `Error retention purge for workspace ${workspaceId}:`,
            error,
          );
        }
      }

      // 3) Purge empty threads
      const threads = await this.chatThreadRepository.find({
        relations: ['messages'],
      });

      const emptyThreads = threads.filter((t) => !t.messages?.length);

      if (emptyThreads.length > 0) {
        await this.chatThreadRepository.remove(emptyThreads);
        emptyThreadsDeleted = emptyThreads.length;
        this.logger.debug(`Purged ${emptyThreads.length} empty threads`);
      }

      this.logger.log(
        `Purge completed: ${chatMessagesDeleted} chat messages, ${emptyThreadsDeleted} empty threads, ${errors} errors`,
      );
      return {
        chatMessages: chatMessagesDeleted,
        emptyThreads: emptyThreadsDeleted,
        errors,
      };
    } catch (error) {
      this.logger.error('Error during chat purge:', error);
      throw error;
    }
  }

  /**
   * Purge expired memory. Run after chat purge.
   * Deletes: (1) orphaned thread/document memories, (2) memories older than text retention.
   */
  async purgeExpiredMemory(): Promise<{ deleted: number; errors: number }> {
    this.logger.log('Starting purge of expired memory...');
    let deleted = 0;
    let errors = 0;

    try {
      const memories = await this.memoryRepository.find();

      for (const mem of memories) {
        try {
          let shouldDelete = false;

          if (mem.scopeType === 'thread') {
            const threadExists = await this.chatThreadRepository.exists({
              where: { id: mem.scopeId },
            });
            if (!threadExists) {
              shouldDelete = true;
            }
          } else if (mem.scopeType === 'document') {
            const docExists = await this.documentRepository.exists({
              where: { id: mem.scopeId },
            });
            if (!docExists) {
              shouldDelete = true;
            }
          }

          if (!shouldDelete) {
            const config = await this.retentionService.getRetentionConfig(mem.workspaceId);
            const retentionDays =
              config.retentionOverrides?.['text'] ?? config.defaultTextEmbeddingsRetentionDays;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - retentionDays);
            if (mem.updatedAt < cutoff) {
              shouldDelete = true;
            }
          }

          if (shouldDelete) {
            await this.memoryRepository.remove(mem);
            deleted++;
          }
        } catch (error) {
          errors++;
          this.logger.error(`Error purging memory ${mem.id}:`, error);
        }
      }

      this.logger.log(`Memory purge completed: ${deleted} deleted, ${errors} errors`);
      return { deleted, errors };
    } catch (error) {
      this.logger.error('Error during memory purge:', error);
      throw error;
    }
  }

  /**
   * Run full purge (files + text/embeddings + chat + memory)
   */
  async runFullPurge(): Promise<{
    files: { deleted: number; errors: number };
    textEmbeddings: { deleted: number; errors: number };
    chat: {
      chatMessages: number;
      emptyThreads: number;
      errors: number;
    };
    memory: { deleted: number; errors: number };
  }> {
    this.logger.log('Running full purge job...');
    const startTime = Date.now();

    const filesResult = await this.purgeExpiredFiles();
    const textEmbeddingsResult = await this.purgeExpiredTextAndEmbeddings();
    const chatResult = await this.purgeExpiredChatMessages();
    const memoryResult = await this.purgeExpiredMemory();

    const duration = Date.now() - startTime;
    this.logger.log(
      `Full purge completed in ${duration}ms: ${filesResult.deleted} files, ${textEmbeddingsResult.deleted} chunks, ${chatResult.chatMessages} chat messages, ${chatResult.emptyThreads} empty threads, ${memoryResult.deleted} memories deleted`,
    );

    return {
      files: filesResult,
      textEmbeddings: textEmbeddingsResult,
      chat: chatResult,
      memory: memoryResult,
    };
  }
}
