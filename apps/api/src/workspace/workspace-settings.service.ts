import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isTranscriptionProviderId,
  TRANSCRIPTION_PROVIDER_IDS,
  type TranscriptionProviderId,
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

    const transcriptionProviderApiKeys: Record<string, boolean> = {};
    if (
      settings.transcriptionProviderApiKeys &&
      typeof settings.transcriptionProviderApiKeys === 'object'
    ) {
      for (const key of Object.keys(settings.transcriptionProviderApiKeys)) {
        transcriptionProviderApiKeys[key] = !!settings.transcriptionProviderApiKeys[key];
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
      transcriptionProviderApiKeys,
      preferredTranscriptionProvider: settings.preferredTranscriptionProvider
        ? (settings.preferredTranscriptionProvider as TranscriptionProviderId)
        : null,
    };
  }

  async getPreferredTranscriptionProvider(
    workspaceId: string,
  ): Promise<TranscriptionProviderId | null> {
    const settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });
    const raw = settings?.preferredTranscriptionProvider ?? null;
    if (raw && isTranscriptionProviderId(raw)) {
      return raw;
    }
    return null;
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

  async getDecryptedTranscriptionApiKey(
    workspaceId: string,
    providerId: TranscriptionProviderId,
  ): Promise<string | null> {
    const settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });
    if (!settings?.transcriptionProviderApiKeys?.[providerId]) {
      return null;
    }
    try {
      return this.encryptionService.decrypt(
        settings.transcriptionProviderApiKeys[providerId] as string,
      );
    } catch {
      return null;
    }
  }

  /**
   * Resolves the effective transcription provider and API key for a workspace.
   * Uses: preferred provider (if has key) -> first provider with key -> fallback from env.
   * Loads workspace settings once to minimize DB calls.
   */
  async resolveEffectiveTranscriptionProvider(
    workspaceId: string,
    fallbackProviderId: () => TranscriptionProviderId,
  ): Promise<{ providerId: TranscriptionProviderId; apiKey: string } | null> {
    const settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });
    const keys = settings?.transcriptionProviderApiKeys;
    if (!keys || typeof keys !== 'object') {
      return null;
    }

    const decrypt = (providerId: TranscriptionProviderId): string | null => {
      const encrypted = keys[providerId];
      if (!encrypted || typeof encrypted !== 'string') return null;
      try {
        return this.encryptionService.decrypt(encrypted);
      } catch {
        return null;
      }
    };

    const raw = settings?.preferredTranscriptionProvider ?? null;
    const preferred =
      raw && isTranscriptionProviderId(raw) ? raw : null;
    if (preferred) {
      const key = decrypt(preferred);
      if (key) return { providerId: preferred, apiKey: key };
    }

    for (const id of TRANSCRIPTION_PROVIDER_IDS) {
      const key = decrypt(id);
      if (key) return { providerId: id, apiKey: key };
    }

    const fallbackId = fallbackProviderId();
    const fallbackKey = decrypt(fallbackId);
    if (fallbackKey) return { providerId: fallbackId, apiKey: fallbackKey };

    return null;
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

    const transcriptionProviderApiKeys = config.transcriptionProviderApiKeys;
    if (
      transcriptionProviderApiKeys !== undefined &&
      typeof transcriptionProviderApiKeys === 'object'
    ) {
      const encrypted: Record<string, string> =
        settings.transcriptionProviderApiKeys ?? {};
      for (const [providerId, rawValue] of Object.entries(
        transcriptionProviderApiKeys,
      )) {
        if (!isTranscriptionProviderId(providerId)) continue;
        const strVal = typeof rawValue === 'string' ? rawValue : '';
        if (strVal.trim()) {
          try {
            encrypted[providerId] = this.encryptionService.encrypt(strVal.trim());
          } catch (encErr) {
            const msg = encErr instanceof Error ? encErr.message : String(encErr);
            if (msg.includes('PARSER_KEYS_ENCRYPTION_KEY')) {
              throw new BadRequestException(
                'Server encryption key not configured. Add PARSER_KEYS_ENCRYPTION_KEY to .env (generate with: openssl rand -hex 32). Required for storing transcription API keys.',
              );
            }
            throw encErr;
          }
        } else if (
          rawValue === false ||
          rawValue === null ||
          rawValue === undefined
        ) {
          delete encrypted[providerId];
        }
      }
      settings.transcriptionProviderApiKeys =
        Object.keys(encrypted).length > 0 ? encrypted : null;
    }

    if (config.preferredTranscriptionProvider !== undefined) {
      const value = config.preferredTranscriptionProvider;
      if (value == null || (typeof value === 'string' && value.trim() === '')) {
        settings.preferredTranscriptionProvider = null;
      } else if (isTranscriptionProviderId(value)) {
        settings.preferredTranscriptionProvider = value;
      } else {
        throw new BadRequestException(
          `Preferred transcription provider must be one of: huggingface, openai`,
        );
      }
    }

    settings = await this.workspaceSettingsRepository.save(settings);

    return this.getSettings(workspaceId);
  }
}
