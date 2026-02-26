import type { IImageAssetStrategy, ImageValidationResult } from './interfaces/image-asset-strategy.interface';

/**
 * Strategy-aware image validator.
 * Delegates to the strategy's validate method for context-specific rules.
 */
export class ImageValidator {
  static async validate(
    strategy: IImageAssetStrategy,
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<ImageValidationResult> {
    return strategy.validate(buffer, mimeType, fileName);
  }
}
