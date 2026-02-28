import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentFile } from '../entities/document-file.entity';
import { Document } from '../entities/document.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
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
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(DocumentVersion)
    private versionRepository: Repository<DocumentVersion>,
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
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
   * Purge expired chat messages and versions (accelerated purge for no-logs)
   */
  async purgeExpiredChatAndVersions(): Promise<{ chatMessages: number; versions: number; errors: number }> {
    this.logger.log('Starting purge of expired chat messages and versions...');
    let chatMessagesDeleted = 0;
    let versionsDeleted = 0;
    let errors = 0;

    try {
      // Get all workspaces with no-logs enabled
      const workspacesWithNoLogs = await this.settingsRepository.find({
        where: { noLogsEnabled: true },
      });

      for (const settings of workspacesWithNoLogs) {
        try {
          const acceleratedPurgeDays = settings.noLogsConfig?.acceleratedPurgeDays || 1;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - acceleratedPurgeDays);

          // Purge chat messages
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
                `Purged ${expiredChatMessages.length} chat messages for workspace ${settings.workspaceId}`,
              );
            }
          }

          // Purge versions
          if (settings.noLogsConfig?.skipVersions) {
            const versions = await this.versionRepository.find({
              where: { workspaceId: settings.workspaceId },
            });

            const expiredVersions = versions.filter((v) => v.createdAt < cutoffDate);

            if (expiredVersions.length > 0) {
              await this.versionRepository.remove(expiredVersions);
              versionsDeleted += expiredVersions.length;
              this.logger.debug(
                `Purged ${expiredVersions.length} versions for workspace ${settings.workspaceId}`,
              );
            }
          }
        } catch (error) {
          errors++;
          this.logger.error(`Error purging chat/versions for workspace ${settings.workspaceId}:`, error);
        }
      }

      this.logger.log(
        `Purge completed: ${chatMessagesDeleted} chat messages, ${versionsDeleted} versions deleted, ${errors} errors`,
      );
      return { chatMessages: chatMessagesDeleted, versions: versionsDeleted, errors };
    } catch (error) {
      this.logger.error('Error during chat/versions purge:', error);
      throw error;
    }
  }

  /**
   * Run full purge (files + text/embeddings + chat/versions)
   */
  async runFullPurge(): Promise<{
    files: { deleted: number; errors: number };
    textEmbeddings: { deleted: number; errors: number };
    chatAndVersions: { chatMessages: number; versions: number; errors: number };
  }> {
    this.logger.log('Running full purge job...');
    const startTime = Date.now();

    const filesResult = await this.purgeExpiredFiles();
    const textEmbeddingsResult = await this.purgeExpiredTextAndEmbeddings();
    const chatAndVersionsResult = await this.purgeExpiredChatAndVersions();

    const duration = Date.now() - startTime;
    this.logger.log(
      `Full purge completed in ${duration}ms: ${filesResult.deleted} files, ${textEmbeddingsResult.deleted} chunks, ${chatAndVersionsResult.chatMessages} chat messages, ${chatAndVersionsResult.versions} versions deleted`,
    );

    return {
      files: filesResult,
      textEmbeddings: textEmbeddingsResult,
      chatAndVersions: chatAndVersionsResult,
    };
  }
}
