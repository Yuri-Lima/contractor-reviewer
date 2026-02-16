import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkspaceSettingsConfig,
  UpdateWorkspaceSettingsRequest,
  RetentionConfig,
  ChunkingStrategy,
  DocumentParser,
} from '@contractai-review/shared';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { EncryptionService } from '../common/encryption.service';

const ALLOWED_CHUNKING_STRATEGIES = [
  ChunkingStrategy.PARAGRAPH,
  ChunkingStrategy.SENTENCE,
  ChunkingStrategy.FIXED_SIZE,
];

const ALLOWED_DOCUMENT_PARSERS = [
  DocumentParser.DOCLING,
  DocumentParser.PDFPLUMBER,
  DocumentParser.DPT2,
  DocumentParser.LLAMAPARSE,
  DocumentParser.UNSTRUCTURED,
];

@Injectable()
export class WorkspaceSettingsService {
  private readonly MIN_FILE_RETENTION_DAYS = 1;
  private readonly MAX_FILE_RETENTION_DAYS = 365;
  private readonly MIN_TEXT_RETENTION_DAYS = 1;
  private readonly MAX_TEXT_RETENTION_DAYS = 730;

  constructor(
    @InjectRepository(WorkspaceSettings)
    private workspaceSettingsRepository: Repository<WorkspaceSettings>,
    private encryptionService: EncryptionService,
  ) {}

  async getSettings(workspaceId: string): Promise<WorkspaceSettingsConfig> {
    let settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });

    if (!settings) {
      settings = this.workspaceSettingsRepository.create({
        workspaceId,
        defaultFileRetentionDays: 30,
        defaultTextEmbeddingsRetentionDays: 90,
        chunkingStrategy: ChunkingStrategy.PARAGRAPH,
        defaultDocumentParser: 'docling',
      });
      settings = await this.workspaceSettingsRepository.save(settings);
    }

    const retention: RetentionConfig = {
      defaultFileRetentionDays: settings.defaultFileRetentionDays,
      defaultTextEmbeddingsRetentionDays: settings.defaultTextEmbeddingsRetentionDays,
      retentionOverrides: settings.retentionOverrides || {},
      fuzzyMatchThreshold: settings.fuzzyMatchThreshold ?? 70,
    };

    const parserApiKeysMasked: Record<string, boolean> = {};
    if (settings.parserApiKeys && typeof settings.parserApiKeys === 'object') {
      for (const key of Object.keys(settings.parserApiKeys)) {
        parserApiKeysMasked[key] = !!settings.parserApiKeys[key];
      }
    }

    return {
      retention,
      general: {},
      documentProcessing: {
        chunkingStrategy: settings.chunkingStrategy ?? 'paragraph',
        defaultDocumentParser: settings.defaultDocumentParser ?? 'docling',
        parserApiKeys: parserApiKeysMasked,
      },
    };
  }

  async getDecryptedApiKey(
    workspaceId: string,
    parserId: string,
  ): Promise<string | null> {
    const settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });
    if (!settings?.parserApiKeys?.[parserId]) {
      return null;
    }
    try {
      return this.encryptionService.decrypt(
        settings.parserApiKeys[parserId] as string,
      );
    } catch {
      return null;
    }
  }

  async updateSettings(
    workspaceId: string,
    config: UpdateWorkspaceSettingsRequest,
  ): Promise<WorkspaceSettingsConfig> {
    let settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });

    if (!settings) {
      settings = this.workspaceSettingsRepository.create({
        workspaceId,
        defaultFileRetentionDays: 30,
        defaultTextEmbeddingsRetentionDays: 90,
        chunkingStrategy: ChunkingStrategy.PARAGRAPH,
        defaultDocumentParser: 'docling',
      });
    }

    if (config.retention !== undefined) {
      const { retention } = config;
      if (retention.defaultFileRetentionDays !== undefined) {
        if (
          retention.defaultFileRetentionDays < this.MIN_FILE_RETENTION_DAYS ||
          retention.defaultFileRetentionDays > this.MAX_FILE_RETENTION_DAYS
        ) {
          throw new BadRequestException(
            `File retention must be between ${this.MIN_FILE_RETENTION_DAYS} and ${this.MAX_FILE_RETENTION_DAYS} days`,
          );
        }
        settings.defaultFileRetentionDays = retention.defaultFileRetentionDays;
      }
      if (retention.defaultTextEmbeddingsRetentionDays !== undefined) {
        if (
          retention.defaultTextEmbeddingsRetentionDays < this.MIN_TEXT_RETENTION_DAYS ||
          retention.defaultTextEmbeddingsRetentionDays > this.MAX_TEXT_RETENTION_DAYS
        ) {
          throw new BadRequestException(
            `Text/embeddings retention must be between ${this.MIN_TEXT_RETENTION_DAYS} and ${this.MAX_TEXT_RETENTION_DAYS} days`,
          );
        }
        settings.defaultTextEmbeddingsRetentionDays =
          retention.defaultTextEmbeddingsRetentionDays;
      }
      if (retention.retentionOverrides !== undefined) {
        settings.retentionOverrides = retention.retentionOverrides;
      }
      if (retention.fuzzyMatchThreshold !== undefined) {
        if (
          retention.fuzzyMatchThreshold < 0 ||
          retention.fuzzyMatchThreshold > 100
        ) {
          throw new BadRequestException(
            'Fuzzy match threshold must be between 0 and 100',
          );
        }
        settings.fuzzyMatchThreshold = retention.fuzzyMatchThreshold;
      }
    }

    if (config.documentProcessing !== undefined) {
      const { chunkingStrategy, defaultDocumentParser, parserApiKeys } =
        config.documentProcessing;
      if (chunkingStrategy !== undefined) {
        if (!ALLOWED_CHUNKING_STRATEGIES.includes(chunkingStrategy as ChunkingStrategy)) {
          throw new BadRequestException(
            `Chunking strategy must be one of: ${ALLOWED_CHUNKING_STRATEGIES.join(', ')}`,
          );
        }
        settings.chunkingStrategy = chunkingStrategy;
      }
      if (defaultDocumentParser !== undefined) {
        if (!ALLOWED_DOCUMENT_PARSERS.includes(defaultDocumentParser as DocumentParser)) {
          throw new BadRequestException(
            `Default document parser must be one of: ${ALLOWED_DOCUMENT_PARSERS.join(', ')}`,
          );
        }
        settings.defaultDocumentParser = defaultDocumentParser;
      }
      if (parserApiKeys !== undefined && typeof parserApiKeys === 'object') {
        const encrypted: Record<string, string> = settings.parserApiKeys ?? {};
        for (const [parserId, rawValue] of Object.entries(parserApiKeys)) {
          const strVal = typeof rawValue === 'string' ? rawValue : '';
          if (strVal.trim()) {
            encrypted[parserId] = this.encryptionService.encrypt(strVal.trim());
          } else if (rawValue === false || rawValue === null || rawValue === undefined) {
            delete encrypted[parserId];
          }
        }
        settings.parserApiKeys =
          Object.keys(encrypted).length > 0 ? encrypted : null;
      }
    }

    settings = await this.workspaceSettingsRepository.save(settings);

    return this.getSettings(workspaceId);
  }
}
