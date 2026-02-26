import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { ImageAsset as ImageAssetType, ImageAssetContext } from '@contractai-review/shared';
import { NoopMalwareScanner, StorageServiceToken } from '../storage/storage.module';
import type { IStorageService } from '../storage/storage.interface';
import { StorageResolverService } from '../storage/storage-resolver.service';
import { ImageAsset } from '../entities/image-asset.entity';
import { ImageAssetStrategyRegistry } from './image-asset-strategy.registry';
import { ImageValidator } from './image-validator';
@Injectable()
export class ImageManagerService {
  constructor(
    @InjectRepository(ImageAsset)
    private readonly imageAssetRepository: Repository<ImageAsset>,
    private readonly strategyRegistry: ImageAssetStrategyRegistry,
    private readonly malwareScanner: NoopMalwareScanner,
    @Inject(StorageServiceToken)
    private readonly defaultStorage: IStorageService,
    private readonly storageResolver: StorageResolverService,
  ) {}

  async uploadImage(
    context: ImageAssetContext,
    ownerId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<ImageAssetType> {
    const strategy = this.strategyRegistry.get(context);

    const validation = await ImageValidator.validate(
      strategy,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    if (!validation.isValid) {
      throw new BadRequestException(validation.error ?? 'Invalid image');
    }

    const scanResult = await this.malwareScanner.scanFile(file.buffer, file.originalname);
    if (!scanResult.safe) {
      throw new BadRequestException(`File rejected: ${scanResult.threat ?? 'Security scan failed'}`);
    }

    const ext = file.originalname.toLowerCase().split('.').pop() ?? 'png';
    const assetId = randomUUID();

    const storageKey = this.buildStorageKey(strategy, context, ownerId, assetId, ext);

    const [workspaceId, documentId, fileName] = this.parseStorageKeyForUpload(storageKey);

    const storage = await this.getStorageForContext(context, ownerId);

    await storage.uploadFile(
      file.buffer,
      fileName,
      file.mimetype,
      workspaceId,
      documentId,
    );

    const existing = await this.imageAssetRepository.findOne({
      where: { context, ownerId },
    });
    if (existing) {
      const existingStorage = await this.getStorageForContext(context, ownerId);
      await existingStorage.deleteFile(existing.storageKey);
      await this.imageAssetRepository.remove(existing);
    }

    const asset = this.imageAssetRepository.create({
      context,
      ownerId,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
    const saved = await this.imageAssetRepository.save(asset);

    return this.toApiAsset(saved);
  }

  async getAsset(context: ImageAssetContext, ownerId: string): Promise<ImageAssetType | null> {
    const asset = await this.imageAssetRepository.findOne({
      where: { context, ownerId },
    });
    return asset ? this.toApiAsset(asset) : null;
  }

  async getImageUrl(
    context: ImageAssetContext,
    ownerId: string,
    variant: 'original' | 'thumb' | 'medium' = 'original',
    expiresIn = 3600,
  ): Promise<string> {
    const asset = await this.imageAssetRepository.findOne({
      where: { context, ownerId },
    });
    if (!asset) {
      throw new NotFoundException('Image asset not found');
    }

    let key = asset.storageKey;
    if (variant !== 'original' && asset.variantKeys) {
      const variantKey = variant === 'thumb' ? asset.variantKeys.thumb : asset.variantKeys.medium;
      if (variantKey) key = variantKey;
    }

    const storage = await this.getStorageForContext(context, ownerId);
    return storage.getFileUrl(key, expiresIn);
  }

  async getImageBuffer(context: ImageAssetContext, ownerId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
  }> {
    const asset = await this.imageAssetRepository.findOne({
      where: { context, ownerId },
    });
    if (!asset) {
      throw new NotFoundException('Image asset not found');
    }

    const storage = await this.getStorageForContext(context, ownerId);
    const buffer = await storage.getFileBuffer(asset.storageKey);
    return { buffer, mimeType: asset.mimeType };
  }

  async deleteImage(context: ImageAssetContext, ownerId: string): Promise<void> {
    const asset = await this.imageAssetRepository.findOne({
      where: { context, ownerId },
    });
    if (!asset) {
      return;
    }

    const storage = await this.getStorageForContext(context, ownerId);
    await storage.deleteFile(asset.storageKey);
    if (asset.variantKeys) {
      if (asset.variantKeys.thumb) {
        await storage.deleteFile(asset.variantKeys.thumb).catch(() => {});
      }
      if (asset.variantKeys.medium) {
        await storage.deleteFile(asset.variantKeys.medium).catch(() => {});
      }
    }
    await this.imageAssetRepository.remove(asset);
  }

  private async getStorageForContext(
    context: ImageAssetContext,
    ownerId: string,
  ): Promise<IStorageService> {
    if (context === 'avatar') {
      return this.storageResolver.getStorageForUser(ownerId);
    }
    return this.defaultStorage;
  }

  private buildStorageKey(
    strategy: { getStoragePath: (ownerId: string, assetId?: string, ext?: string) => string },
    context: ImageAssetContext,
    ownerId: string,
    assetId: string,
    ext: string,
  ): string {
    return strategy.getStoragePath(ownerId, assetId, ext);
  }

  private parseStorageKeyForUpload(
    storageKey: string,
  ): [workspaceId: string, documentId: string, fileName: string] {
    const parts = storageKey.split('/');
    if (parts.length < 3) {
      throw new Error(`Invalid storage key format: ${storageKey}`);
    }
    const workspaceId = parts[0];
    const documentId = parts.slice(1, -1).join('/');
    const fileName = parts[parts.length - 1];
    return [workspaceId, documentId, fileName];
  }

  private toApiAsset(asset: ImageAsset): ImageAssetType {
    return {
      id: asset.id,
      context: asset.context,
      ownerId: asset.ownerId,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      sizeBytes: Number(asset.sizeBytes),
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
