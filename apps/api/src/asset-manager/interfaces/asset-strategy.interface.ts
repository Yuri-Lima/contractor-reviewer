import type { AssetStrategyConfig } from '@contractai-review/shared';

export interface AssetValidationResult {
  isValid: boolean;
  error?: string;
  errorKey?: string;
}

export interface IAssetStrategy {
  readonly config: AssetStrategyConfig;
  validate(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    options?: { signal?: AbortSignal },
  ): Promise<AssetValidationResult>;
  getStoragePath(ownerId: string, assetId?: string, ext?: string): string;
}
