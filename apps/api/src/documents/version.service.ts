import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentVersion, RedlinePlaybook } from '../entities/document-version.entity';
import { Document } from '../entities/document.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';

export interface RedlineResponse {
  versionId: string;
  changes: Array<{
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
  playbook: RedlinePlaybook;
  createdAt: Date;
}

@Injectable()
export class VersionService {
  constructor(
    @InjectRepository(DocumentVersion)
    private versionRepository: Repository<DocumentVersion>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
  ) {}

  /**
   * Create a new document version from redline
   */
  async createVersion(
    documentId: string,
    workspaceId: string,
    userId: string,
    playbook: RedlinePlaybook,
    changes: Array<{
      section: string;
      original: string;
      suggested: string;
      reason: string;
    }>,
    instructions?: string,
    prompt?: string,
  ): Promise<DocumentVersion> {
    // Get current version number
    const lastVersion = await this.versionRepository.findOne({
      where: { documentId },
      order: { versionNumber: 'DESC' },
    });

    const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    // Check no-logs configuration
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    const noLogsEnabled = settings?.noLogsEnabled || false;
    const skipVersions = settings?.noLogsConfig?.skipVersions || false;

    // Create version
    const version = this.versionRepository.create({
      documentId,
      workspaceId,
      userId,
      versionNumber,
      playbook,
      instructions: noLogsEnabled || skipVersions ? null : instructions,
      changes: noLogsEnabled || skipVersions ? null : changes,
      prompt: noLogsEnabled || skipVersions ? null : prompt,
    });

    return await this.versionRepository.save(version);
  }

  /**
   * Get all versions for a document
   */
  async getVersions(documentId: string, workspaceId: string): Promise<DocumentVersion[]> {
    return await this.versionRepository.find({
      where: { documentId, workspaceId },
      order: { versionNumber: 'ASC' },
    });
  }
}
