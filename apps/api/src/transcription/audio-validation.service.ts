import { Injectable } from '@nestjs/common';
import {
  AUDIO_ALLOWED_EXTENSIONS,
  AUDIO_ALLOWED_MIME_TYPES,
  AUDIO_MAX_SIZE_BYTES,
} from '@contractai-review/shared';
import { FileTypeDetectionService } from '../file-type/file-type-detection.service';

export interface AudioValidationResult {
  isValid: boolean;
  error?: string;
}

@Injectable()
export class AudioValidationService {
  constructor(private readonly fileTypeService: FileTypeDetectionService) {}

  validateExtension(fileName: string): AudioValidationResult {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.') || 0);
    if (!(AUDIO_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        isValid: false,
        error: `File extension ${ext} is not allowed. Allowed: ${AUDIO_ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }
    return { isValid: true };
  }

  validateSize(fileSize: number): AudioValidationResult {
    if (fileSize > AUDIO_MAX_SIZE_BYTES) {
      return {
        isValid: false,
        error: `Audio size exceeds maximum ${AUDIO_MAX_SIZE_BYTES / 1024 / 1024}MB`,
      };
    }
    if (fileSize === 0) {
      return { isValid: false, error: 'Audio file is empty' };
    }
    return { isValid: true };
  }

  async validateMimeType(
    mimeType: string,
    buffer: Buffer,
    options?: { signal?: AbortSignal },
  ): Promise<AudioValidationResult> {
    const baseType = mimeType.split(';')[0].trim().toLowerCase();
    const isAllowed = (AUDIO_ALLOWED_MIME_TYPES as readonly string[]).some(
      (allowed) => allowed.toLowerCase() === baseType,
    );
    if (!isAllowed) {
      return {
        isValid: false,
        error: `MIME type ${mimeType} is not allowed. Allowed: ${AUDIO_ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }
    const detected = await this.fileTypeService.detect(buffer, { signal: options?.signal });
    if (detected) {
      const detectedAllowed = (AUDIO_ALLOWED_MIME_TYPES as readonly string[]).some(
        (allowed) => allowed.toLowerCase() === detected.mime,
      );
      if (!detectedAllowed) {
        return {
          isValid: false,
          error: `File signature does not match allowed audio format. Detected: ${detected.mime}`,
        };
      }
    }
    return { isValid: true };
  }

  async getEffectiveMimeType(
    mimeType: string,
    buffer: Buffer,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    const detected = await this.fileTypeService.detect(buffer, { signal: options?.signal });
    if (detected) {
      if (detected.mime === 'audio/mp4' || detected.mime === 'video/mp4') {
        return 'audio/m4a';
      }
      return detected.mime;
    }
    return mimeType.split(';')[0].trim().toLowerCase();
  }

  async validate(
    fileName: string,
    mimeType: string,
    fileSize: number,
    buffer: Buffer,
    options?: { signal?: AbortSignal },
  ): Promise<AudioValidationResult> {
    const extCheck = this.validateExtension(fileName);
    if (!extCheck.isValid) return extCheck;
    const sizeCheck = this.validateSize(fileSize);
    if (!sizeCheck.isValid) return sizeCheck;
    const mimeCheck = await this.validateMimeType(mimeType, buffer, options);
    if (!mimeCheck.isValid) return mimeCheck;
    return { isValid: true };
  }
}
