import type { IAssetStrategy, AssetValidationResult } from './interfaces/asset-strategy.interface';

/**
 * Strategy-aware asset validator.
 * Delegates to the strategy's validate method for context-specific rules.
 */
export class AssetValidator {
  static async validate(
    strategy: IAssetStrategy,
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    options?: { signal?: AbortSignal },
  ): Promise<AssetValidationResult> {
    return strategy.validate(buffer, mimeType, fileName, options);
  }
}
