import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { DocumentVersion, RedlinePlaybook } from '../entities/document-version.entity';
import { Document } from '../entities/document.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { DiffService, type DiffBlock } from './diff.service';
import { DocumentsService } from './documents.service';

export interface RedlineChange {
  section: string;
  originalText: string;
  suggestedText: string;
  diffBlocks: DiffBlock[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Array<{
    kind: 'contract';
    file?: string;
    page?: number;
    spanId?: string;
    quoteSnippet?: string;
  }>;
  legalCitations: Array<{
    kind: 'legal';
    source?: string;
    section?: string;
    url?: string;
  }>;
  notFound: boolean;
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
    private diffService: DiffService,
    private documentsService: DocumentsService,
  ) {}

  /**
   * Create a new document version from redline
   */
  async createVersion(
    documentId: string,
    workspaceId: string,
    userId: string,
    playbook: RedlinePlaybook,
    changes: RedlineChange[],
    instructions?: string,
    prompt?: string,
    parentVersionId?: string,
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
      parentVersionId: parentVersionId || null,
    });

    return await this.versionRepository.save(version);
  }

  /**
   * Apply decisions to create a new version
   */
  async applyVersion(
    versionId: string,
    documentId: string,
    workspaceId: string,
    userId: string,
    decisions: Array<{ blockId: string; decision: 'accept' | 'reject' }>,
    finalText: string,
  ): Promise<DocumentVersion> {
    // Get parent version
    const parentVersion = await this.versionRepository.findOne({
      where: { id: versionId, documentId, workspaceId },
    });

    if (!parentVersion) {
      throw new Error('Parent version not found');
    }

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

    // Create decisions array with timestamps
    const decisionsWithTimestamps = decisions.map((d) => ({
      blockId: d.blockId,
      decision: d.decision,
      userId,
      timestamp: new Date(),
    }));

    // Create new version
    const version = this.versionRepository.create({
      documentId,
      workspaceId,
      userId,
      versionNumber,
      playbook: parentVersion.playbook,
      instructions: null,
      changes: noLogsEnabled || skipVersions ? null : parentVersion.changes,
      prompt: null,
      parentVersionId: versionId,
      decisions: noLogsEnabled || skipVersions ? null : decisionsWithTimestamps,
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

  /**
   * Get a specific version by ID
   */
  async getVersionById(
    versionId: string,
    documentId: string,
    workspaceId: string,
  ): Promise<DocumentVersion | null> {
    return await this.versionRepository.findOne({
      where: { id: versionId, documentId, workspaceId },
    });
  }

  /**
   * Get current content reconstructed from all applied versions
   */
  async getCurrentContent(
    documentId: string,
    workspaceId: string,
  ): Promise<{ content: string; versionNumber: number; lastUpdated: Date }> {
    // Get all applied versions (with parentVersionId not null) ordered by versionNumber
    const appliedVersions = await this.versionRepository.find({
      where: {
        documentId,
        workspaceId,
        parentVersionId: Not(IsNull()),
      },
      order: { versionNumber: 'ASC' },
    });

    // If no applied versions, return original text from chunks
    if (appliedVersions.length === 0) {
      const originalText = await this.documentsService.getOriginalText(documentId, workspaceId);
      return {
        content: originalText,
        versionNumber: 0,
        lastUpdated: new Date(),
      };
    }

    // Start with original text
    let currentText = await this.documentsService.getOriginalText(documentId, workspaceId);

    // Apply each version in sequence
    for (const version of appliedVersions) {
      if (!version.changes || version.changes.length === 0) {
        continue;
      }

      const change = version.changes[0];
      
      // If version has decisions, apply changes only to the specific region
      if (version.decisions && version.decisions.length > 0) {
        const decisions = version.decisions.map((d) => ({
          blockId: d.blockId,
          decision: d.decision,
        }));
        
        // Get fuzzy threshold from settings
        const settings = await this.settingsRepository.findOne({
          where: { workspaceId },
        });
        const fuzzyThreshold = settings?.fuzzyMatchThreshold || 70;
        
        // Apply changes only to the region where originalText appears
        currentText = this.diffService.applyChangesToRegion(
          currentText,        // Full document
          change.originalText, // Region to find and replace
          change.diffBlocks,   // Diff blocks for the region
          decisions,          // User decisions
          undefined,          // No explicit region (use fuzzy matching)
          fuzzyThreshold,    // Use threshold from settings
        );
      } else {
        // Use suggestedText directly (for versions created before decisions were tracked)
        // Still need to find and replace only the region
        const startIndex = currentText.indexOf(change.originalText);
        if (startIndex !== -1) {
          const endIndex = startIndex + change.originalText.length;
          currentText = 
            currentText.substring(0, startIndex) + 
            change.suggestedText + 
            currentText.substring(endIndex);
        }
      }
    }

    const lastVersion = appliedVersions[appliedVersions.length - 1];

    return {
      content: currentText,
      versionNumber: lastVersion.versionNumber,
      lastUpdated: lastVersion.createdAt,
    };
  }

  /**
   * Get content for a specific version
   */
  async getVersionContent(
    versionId: string,
    documentId: string,
    workspaceId: string,
  ): Promise<{ content: string; versionNumber: number; createdAt: Date }> {
    const version = await this.getVersionById(versionId, documentId, workspaceId);

    if (!version) {
      throw new Error('Version not found');
    }

    // If this is a proposal version (no parentVersionId), return suggestedText
    if (!version.parentVersionId) {
      if (!version.changes || version.changes.length === 0) {
        throw new Error('Version has no changes');
      }
      const change = version.changes[0];
      return {
        content: change.suggestedText,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt,
      };
    }

    // If this is an applied version, reconstruct content up to this version
    // Get all applied versions up to and including this one
    const allAppliedVersions = await this.versionRepository.find({
      where: {
        documentId,
        workspaceId,
        parentVersionId: Not(IsNull()),
      },
      order: { versionNumber: 'ASC' },
    });

    const versionsUpToThis = allAppliedVersions.filter((v) => v.versionNumber <= version.versionNumber);

    // Start with original text
    let currentText = await this.documentsService.getOriginalText(documentId, workspaceId);

    // Apply each version in sequence
    for (const v of versionsUpToThis) {
      if (!v.changes || v.changes.length === 0) {
        continue;
      }

      const change = v.changes[0];
      
      if (v.decisions && v.decisions.length > 0) {
        const decisions = v.decisions.map((d) => ({
          blockId: d.blockId,
          decision: d.decision,
        }));
        
        // Get fuzzy threshold from settings
        const settings = await this.settingsRepository.findOne({
          where: { workspaceId },
        });
        const fuzzyThreshold = settings?.fuzzyMatchThreshold || 70;
        
        // Apply changes only to the region where originalText appears
        currentText = this.diffService.applyChangesToRegion(
          currentText,
          change.originalText,
          change.diffBlocks,
          decisions,
          undefined,          // No explicit region (use fuzzy matching)
          fuzzyThreshold,    // Use threshold from settings
        );
      } else {
        // Find and replace only the region
        const startIndex = currentText.indexOf(change.originalText);
        if (startIndex !== -1) {
          const endIndex = startIndex + change.originalText.length;
          currentText = 
            currentText.substring(0, startIndex) + 
            change.suggestedText + 
            currentText.substring(endIndex);
        }
      }
    }

    return {
      content: currentText,
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
    };
  }
}
