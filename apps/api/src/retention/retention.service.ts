import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';

export interface RetentionConfig {
  defaultFileRetentionDays: number;
  defaultTextEmbeddingsRetentionDays: number;
  retentionOverrides?: Record<string, number>;
  fuzzyMatchThreshold?: number; // Minimum match percentage for fuzzy matching (0-100)
}

@Injectable()
export class RetentionService {
  // Limites mínimos e máximos para retention
  private readonly MIN_FILE_RETENTION_DAYS = 1;
  private readonly MAX_FILE_RETENTION_DAYS = 365;
  private readonly MIN_TEXT_RETENTION_DAYS = 1;
  private readonly MAX_TEXT_RETENTION_DAYS = 730; // 2 anos

  constructor(
    @InjectRepository(WorkspaceSettings)
    private workspaceSettingsRepository: Repository<WorkspaceSettings>,
  ) {}

  /**
   * Get or create retention settings for a workspace
   */
  async getRetentionConfig(workspaceId: string): Promise<RetentionConfig> {
    let settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });

    if (!settings) {
      // Create default settings
      settings = this.workspaceSettingsRepository.create({
        workspaceId,
        defaultFileRetentionDays: 30,
        defaultTextEmbeddingsRetentionDays: 90,
      });
      settings = await this.workspaceSettingsRepository.save(settings);
    }

    return {
      defaultFileRetentionDays: settings.defaultFileRetentionDays,
      defaultTextEmbeddingsRetentionDays: settings.defaultTextEmbeddingsRetentionDays,
      retentionOverrides: settings.retentionOverrides || {},
    };
  }

  /**
   * Update retention configuration for a workspace
   */
  async updateRetentionConfig(
    workspaceId: string,
    config: Partial<RetentionConfig>,
  ): Promise<RetentionConfig> {
    // Validate limits
    if (config.defaultFileRetentionDays !== undefined) {
      if (
        config.defaultFileRetentionDays < this.MIN_FILE_RETENTION_DAYS ||
        config.defaultFileRetentionDays > this.MAX_FILE_RETENTION_DAYS
      ) {
        throw new BadRequestException(
          `File retention must be between ${this.MIN_FILE_RETENTION_DAYS} and ${this.MAX_FILE_RETENTION_DAYS} days`,
        );
      }
    }

    if (config.defaultTextEmbeddingsRetentionDays !== undefined) {
      if (
        config.defaultTextEmbeddingsRetentionDays < this.MIN_TEXT_RETENTION_DAYS ||
        config.defaultTextEmbeddingsRetentionDays > this.MAX_TEXT_RETENTION_DAYS
      ) {
        throw new BadRequestException(
          `Text/embeddings retention must be between ${this.MIN_TEXT_RETENTION_DAYS} and ${this.MAX_TEXT_RETENTION_DAYS} days`,
        );
      }
    }

    let settings = await this.workspaceSettingsRepository.findOne({
      where: { workspaceId },
    });

    if (!settings) {
      settings = this.workspaceSettingsRepository.create({
        workspaceId,
        defaultFileRetentionDays: config.defaultFileRetentionDays ?? 30,
        defaultTextEmbeddingsRetentionDays: config.defaultTextEmbeddingsRetentionDays ?? 90,
        retentionOverrides: config.retentionOverrides,
        fuzzyMatchThreshold: config.fuzzyMatchThreshold ?? 70,
      });
    } else {
      if (config.defaultFileRetentionDays !== undefined) {
        settings.defaultFileRetentionDays = config.defaultFileRetentionDays;
      }
      if (config.defaultTextEmbeddingsRetentionDays !== undefined) {
        settings.defaultTextEmbeddingsRetentionDays = config.defaultTextEmbeddingsRetentionDays;
      }
      if (config.retentionOverrides !== undefined) {
        settings.retentionOverrides = config.retentionOverrides;
      }
      if (config.fuzzyMatchThreshold !== undefined) {
        // Validate threshold range
        if (config.fuzzyMatchThreshold < 0 || config.fuzzyMatchThreshold > 100) {
          throw new BadRequestException('Fuzzy match threshold must be between 0 and 100');
        }
        settings.fuzzyMatchThreshold = config.fuzzyMatchThreshold;
      }
    }

    settings = await this.workspaceSettingsRepository.save(settings);

    return {
      defaultFileRetentionDays: settings.defaultFileRetentionDays,
      defaultTextEmbeddingsRetentionDays: settings.defaultTextEmbeddingsRetentionDays,
      retentionOverrides: settings.retentionOverrides || {},
      fuzzyMatchThreshold: settings.fuzzyMatchThreshold || 70,
    };
  }

  /**
   * Calculate expiration date for a file based on workspace retention policy
   */
  calculateFileExpirationDate(workspaceId: string, createdAt: Date): Promise<Date> {
    return this.getRetentionConfig(workspaceId).then((config) => {
      const retentionDays = config.retentionOverrides?.['file'] || config.defaultFileRetentionDays;
      const expirationDate = new Date(createdAt);
      expirationDate.setDate(expirationDate.getDate() + retentionDays);
      return expirationDate;
    });
  }

  /**
   * Calculate expiration date for text/embeddings based on workspace retention policy
   */
  calculateTextExpirationDate(workspaceId: string, createdAt: Date): Promise<Date> {
    return this.getRetentionConfig(workspaceId).then((config) => {
      const retentionDays =
        config.retentionOverrides?.['text'] || config.defaultTextEmbeddingsRetentionDays;
      const expirationDate = new Date(createdAt);
      expirationDate.setDate(expirationDate.getDate() + retentionDays);
      return expirationDate;
    });
  }

  /**
   * Check if a file should be expired based on retention policy
   */
  async isFileExpired(workspaceId: string, createdAt: Date): Promise<boolean> {
    const expirationDate = await this.calculateFileExpirationDate(workspaceId, createdAt);
    return new Date() >= expirationDate;
  }

  /**
   * Check if text/embeddings should be expired based on retention policy
   */
  async isTextExpired(workspaceId: string, createdAt: Date): Promise<boolean> {
    const expirationDate = await this.calculateTextExpirationDate(workspaceId, createdAt);
    return new Date() >= expirationDate;
  }
}
