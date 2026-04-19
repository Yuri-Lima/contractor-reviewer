import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyExportData } from '@contractai-review/shared';
import { abortAsPromise } from '../common/utils/abort-promise';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { MemoryService } from '../memory/memory.service';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private memoryService: MemoryService,
  ) {}

  /**
   * Export privacy data (DSAR-lite)
   */
  async exportPrivacyData(
    workspaceId: string,
    userId: string,
    options?: { signal?: AbortSignal },
  ): Promise<PrivacyExportData> {
    const exportPromise = this.doExportPrivacyData(workspaceId, userId);
    if (options?.signal) {
      return Promise.race([
        exportPromise,
        abortAsPromise(options.signal),
      ]) as Promise<PrivacyExportData>;
    }
    return exportPromise;
  }

  private async doExportPrivacyData(
    workspaceId: string,
    userId: string,
  ): Promise<PrivacyExportData> {
    // Get workspace settings to check no-logs status
    await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    // Get audit logs for this user in this workspace
    const auditLogs = await this.auditLogRepository.find({
      where: {
        workspaceId,
        actorUserId: userId,
      },
      order: { createdAt: 'DESC' },
      take: 1000, // Limit to recent logs
    });

    // Get chat messages for this user in this workspace
    const chatMessages = await this.chatMessageRepository.find({
      where: {
        workspaceId,
        userId,
      },
      order: { createdAt: 'DESC' },
      take: 1000, // Limit to recent messages
    });

    const memories = await this.memoryService.listByWorkspace(workspaceId);

    return {
      workspaceId,
      exportedAt: new Date().toISOString(),
      memories: memories.map((m) => ({
        id: m.id,
        scopeType: m.scopeType,
        scopeId: m.scopeId,
        content: m.content,
        version: m.version,
        updatedAt: m.updatedAt.toISOString(),
      })),
      chatMessages: chatMessages.map((msg) => ({
        id: msg.id,
        documentId: msg.documentId,
        question: msg.question, // May be '[REDACTED]' if no-logs enabled
        answerText: msg.answerText, // May be null if no-logs enabled
        confidence: msg.confidence,
        citations: msg.citations, // May be null if no-logs enabled
        notFound: msg.notFound,
        createdAt: msg.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((log) => ({
        action: log.action,
        targetType: log.targetType,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Toggle no-logs setting with optional granular configuration
   */
  async toggleNoLogs(
    workspaceId: string,
    enabled: boolean,
    config?: {
      skipDocumentContent?: boolean;
      skipChatMessages?: boolean;
      acceleratedPurgeDays?: number;
    },
  ): Promise<void> {
    let settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        workspaceId,
        noLogsEnabled: enabled,
        noLogsConfig: config || null,
      });
    } else {
      settings.noLogsEnabled = enabled;
      if (config) {
        settings.noLogsConfig = {
          ...(settings.noLogsConfig || {}),
          ...config,
        };
      } else if (enabled && !settings.noLogsConfig) {
        // Default config when enabling no-logs
        settings.noLogsConfig = {
          skipDocumentContent: false,
          skipChatMessages: true,
          acceleratedPurgeDays: 1,
        };
      }
    }

    await this.settingsRepository.save(settings);
  }

  /**
   * Get privacy settings
   */
  async getPrivacySettings(workspaceId: string): Promise<{
    noLogsEnabled: boolean;
    defaultFileRetentionDays: number;
    defaultTextEmbeddingsRetentionDays: number;
  }> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    return {
      noLogsEnabled: settings?.noLogsEnabled || false,
      defaultFileRetentionDays: settings?.defaultFileRetentionDays || 30,
      defaultTextEmbeddingsRetentionDays: settings?.defaultTextEmbeddingsRetentionDays || 90,
    };
  }

  /**
   * Get no-logs configuration
   */
  async getNoLogsConfig(workspaceId: string): Promise<{
    enabled: boolean;
    config?: {
      skipDocumentContent?: boolean;
      skipChatMessages?: boolean;
      acceleratedPurgeDays?: number;
    } | null;
  }> {
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    return {
      enabled: settings?.noLogsEnabled || false,
      config: settings?.noLogsConfig || null,
    };
  }
}
