import type { ImageAssetStrategyConfig } from '@contractai-review/shared';

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  errorKey?: string;
}

export interface IImageAssetStrategy {
  readonly config: ImageAssetStrategyConfig;
  validate(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<ImageValidationResult>;
  getStoragePath(ownerId: string, assetId?: string, ext?: string): string;
}
