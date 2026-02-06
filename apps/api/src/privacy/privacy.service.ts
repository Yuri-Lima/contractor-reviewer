import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentJob } from '../entities/document-job.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { DocumentVersion } from '../entities/document-version.entity';

export interface PrivacyExportData {
  workspaceId: string;
  exportedAt: string;
  chatMessages: Array<{
    id: string;
    documentId: string;
    question: string;
    answerText: string | null;
    confidence: string | null;
    citations: Array<any> | null;
    notFound: boolean;
    createdAt: string;
  }>;
  versions: Array<{
    id: string;
    documentId: string;
    versionNumber: number;
    playbook: string | null;
    changes: Array<any> | null;
    createdAt: string;
  }>;
  redlinePrompts: Array<{
    id: string;
    documentId: string;
    playbook: string;
    prompt: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    action: string;
    targetType: string;
    createdAt: string;
  }>;
}

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentFile)
    private fileRepository: Repository<DocumentFile>,
    @InjectRepository(DocumentJob)
    private jobRepository: Repository<DocumentJob>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(DocumentVersion)
    private versionRepository: Repository<DocumentVersion>,
  ) {}

  /**
   * Export privacy data (DSAR-lite)
   */
  async exportPrivacyData(workspaceId: string, userId: string): Promise<PrivacyExportData> {
    // Get workspace settings to check no-logs status
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    const noLogsEnabled = settings?.noLogsEnabled || false;

    // Get documents for this workspace
    const documents = await this.documentRepository.find({
      where: { workspaceId },
      select: ['id', 'title', 'createdAt'],
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

    // Get versions for documents in this workspace (created by this user)
    const documentIds = documents.map((d) => d.id);
    const versions = documentIds.length > 0
      ? await this.versionRepository.find({
          where: {
            workspaceId,
            userId,
            documentId: documentIds.length === 1 ? documentIds[0] : In(documentIds),
          },
          order: { createdAt: 'DESC' },
          take: 1000, // Limit to recent versions
        })
      : [];

    return {
      workspaceId,
      exportedAt: new Date().toISOString(),
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
      versions: versions.map((v) => ({
        id: v.id,
        documentId: v.documentId,
        versionNumber: v.versionNumber,
        playbook: v.playbook,
        changes: v.changes, // May be null if no-logs enabled
        createdAt: v.createdAt.toISOString(),
      })),
      redlinePrompts: versions
        .filter((v) => v.prompt !== null)
        .map((v) => ({
          id: v.id,
          documentId: v.documentId,
          playbook: v.playbook || 'unknown',
          prompt: v.prompt, // May be null if no-logs enabled
          createdAt: v.createdAt.toISOString(),
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
      skipVersions?: boolean;
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
          skipVersions: true,
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
}
