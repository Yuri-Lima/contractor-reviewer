import { Injectable } from '@nestjs/common';
import { IMAGE_ASSET_EXTENSIONS, IMAGE_ASSET_MIME_TYPES } from '@contractai-review/shared';
import { FileTypeDetectionService } from '../../file-type/file-type-detection.service';
import type { AssetStrategyConfig } from '@contractai-review/shared';
import type { IAssetStrategy, AssetValidationResult } from '../interfaces/asset-strategy.interface';

const LOGO_MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const LOGO_MAX_WIDTH = 256;

@Injectable()
export class WorkspaceLogoStrategy implements IAssetStrategy {
  readonly config: AssetStrategyConfig = {
    context: 'workspace_logo',
    maxSizeBytes: LOGO_MAX_SIZE_BYTES,
    maxWidth: LOGO_MAX_WIDTH,
    allowedMimeTypes: IMAGE_ASSET_MIME_TYPES,
    pathPrefix: 'assets/workspaces',
  };

  constructor(private readonly fileTypeService: FileTypeDetectionService) {}

  async validate(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    options?: { signal?: AbortSignal },
  ): Promise<AssetValidationResult> {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!(IMAGE_ASSET_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        isValid: false,
        error: `File extension ${ext} is not allowed`,
        errorKey: 'settings.avatarErrorExtension',
      };
    }
    if (buffer.length > this.config.maxSizeBytes) {
      return {
        isValid: false,
        error: `File size exceeds ${this.config.maxSizeBytes / 1024 / 1024}MB`,
        errorKey: 'settings.avatarSizeError',
      };
    }
    if (buffer.length === 0) {
      return {
        isValid: false,
        error: 'File is empty',
        errorKey: 'settings.avatarErrorEmpty',
      };
    }
    if (!(this.config.allowedMimeTypes as readonly string[]).includes(mimeType)) {
      return {
        isValid: false,
        error: `MIME type ${mimeType} is not allowed`,
        errorKey: 'settings.avatarErrorMime',
      };
    }
    const detected = await this.fileTypeService.detect(buffer, {
      signal: options?.signal,
    });
    if (detected && detected.mime !== mimeType) {
      return {
        isValid: false,
        error: `File signature does not match declared MIME type`,
        errorKey: 'settings.avatarErrorSignature',
      };
    }
    return { isValid: true };
  }

  getStoragePath(ownerId: string, assetId?: string, ext?: string): string {
    const fileName = assetId && ext ? `${assetId}.${ext}` : 'logo.png';
    return `${this.config.pathPrefix}/${ownerId}/logo/${fileName}`;
  }
}
