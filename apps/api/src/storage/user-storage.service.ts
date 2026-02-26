import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import type {
  UpdateUserStorageRequest,
  UserStorageConfigResponse,
  UserStorageConfigWithCredentials,
} from '@contractai-review/shared';
import { UserStorageSettings } from '../entities/user-storage-settings.entity';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class UserStorageService {
  constructor(
    @InjectRepository(UserStorageSettings)
    private readonly userStorageSettingsRepository: Repository<UserStorageSettings>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getConfig(userId: string): Promise<UserStorageConfigResponse> {
    const settings = await this.userStorageSettingsRepository.findOne({
      where: { userId },
    });
    if (!settings) {
      return { configured: false };
    }
    const config = this.decryptConfig(settings.configEncrypted);
    return {
      configured: true,
      provider: config.provider,
      endpoint: config.endpoint || undefined,
      region: config.region || undefined,
      bucket: config.bucket,
    };
  }

  async updateConfig(userId: string, request: UpdateUserStorageRequest): Promise<UserStorageConfigResponse> {
    const config: UserStorageConfigWithCredentials = {
      provider: request.provider,
      endpoint: request.endpoint,
      region: request.region,
      bucket: request.bucket,
      credentials: request.credentials,
    };
    await this.validateBucketConnection(config);
    const encrypted = this.encryptionService.encrypt(JSON.stringify(config));
    let settings = await this.userStorageSettingsRepository.findOne({
      where: { userId },
    });
    if (!settings) {
      settings = this.userStorageSettingsRepository.create({
        userId,
        configEncrypted: encrypted,
      });
    } else {
      settings.configEncrypted = encrypted;
    }
    await this.userStorageSettingsRepository.save(settings);
    return this.getConfig(userId);
  }

  async deleteConfig(userId: string): Promise<void> {
    await this.userStorageSettingsRepository.delete({ userId });
  }

  private async validateBucketConnection(config: UserStorageConfigWithCredentials): Promise<void> {
    const client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint || undefined,
      credentials: {
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
      },
      forcePathStyle: !!config.endpoint,
    });
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to bucket';
      throw new BadRequestException(`Bucket validation failed: ${message}`);
    }
  }

  getDecryptedConfigForUser(userId: string): Promise<UserStorageConfigWithCredentials | null> {
    return this.userStorageSettingsRepository
      .findOne({ where: { userId } })
      .then((s) => (s ? this.decryptConfig(s.configEncrypted) : null));
  }

  private decryptConfig(encrypted: string): UserStorageConfigWithCredentials {
    const json = this.encryptionService.decrypt(encrypted);
    return JSON.parse(json) as UserStorageConfigWithCredentials;
  }
}
