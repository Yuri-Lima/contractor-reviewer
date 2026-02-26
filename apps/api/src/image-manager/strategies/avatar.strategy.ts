import { Injectable } from '@nestjs/common';
import {
  IMAGE_ASSET_EXTENSIONS,
  IMAGE_ASSET_MIME_TYPES,
} from '@contractai-review/shared';
import type { ImageAssetStrategyConfig } from '@contractai-review/shared';
import type {
  IImageAssetStrategy,
  ImageValidationResult,
} from '../interfaces/image-asset-strategy.interface';

const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const AVATAR_MAX_WIDTH = 512;

@Injectable()
export class AvatarStrategy implements IImageAssetStrategy {
  readonly config: ImageAssetStrategyConfig = {
    context: 'avatar',
    maxSizeBytes: AVATAR_MAX_SIZE_BYTES,
    maxWidth: AVATAR_MAX_WIDTH,
    allowedMimeTypes: IMAGE_ASSET_MIME_TYPES,
    pathPrefix: 'assets/avatars',
  };

  async validate(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<ImageValidationResult> {
    // Extension check
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!(IMAGE_ASSET_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        isValid: false,
        error: `File extension ${ext} is not allowed`,
        errorKey: 'settings.avatarErrorExtension',
      };
    }

    // Size check
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

    // MIME check
    if (!(this.config.allowedMimeTypes as readonly string[]).includes(mimeType)) {
      return {
        isValid: false,
        error: `MIME type ${mimeType} is not allowed`,
        errorKey: 'settings.avatarErrorMime',
      };
    }

    // Magic bytes validation
    const detectedMime = this.detectMimeFromBuffer(buffer);
    if (detectedMime && detectedMime !== mimeType) {
      return {
        isValid: false,
        error: `File signature does not match declared MIME type`,
        errorKey: 'settings.avatarErrorSignature',
      };
    }

    return { isValid: true };
  }

  getStoragePath(ownerId: string, assetId?: string, ext?: string): string {
    const fileName = assetId && ext ? `${assetId}.${ext}` : 'avatar.png';
    return `${this.config.pathPrefix}/${ownerId}/${fileName}`;
  }

  private detectMimeFromBuffer(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    return null;
  }
}
