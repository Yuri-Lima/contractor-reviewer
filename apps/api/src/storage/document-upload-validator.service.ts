import { Injectable } from '@nestjs/common';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@contractai-review/shared';
import { FileTypeDetectionService } from '../file-type/file-type-detection.service';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

@Injectable()
export class DocumentUploadValidator {
  private readonly maxFileSize = MAX_FILE_SIZE_BYTES;

  constructor(private readonly fileTypeService: FileTypeDetectionService) {}

  async validateFile(
    fileName: string,
    mimeType: string,
    fileSize: number,
    buffer: Buffer,
    options?: { signal?: AbortSignal },
  ): Promise<FileValidationResult> {
    const extensionCheck = this.validateExtension(fileName);
    if (!extensionCheck.isValid) return extensionCheck;

    const sizeCheck = this.validateSize(fileSize);
    if (!sizeCheck.isValid) return sizeCheck;

    const mimeCheck = await this.validateMimeType(mimeType, buffer, options);
    if (!mimeCheck.isValid) return mimeCheck;

    return { isValid: true };
  }

  private validateExtension(fileName: string): FileValidationResult {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }
    return { isValid: true };
  }

  private validateSize(fileSize: number): FileValidationResult {
    if (fileSize > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      };
    }
    if (fileSize === 0) {
      return { isValid: false, error: 'File is empty' };
    }
    return { isValid: true };
  }

  private async validateMimeType(
    mimeType: string,
    buffer: Buffer,
    options?: { signal?: AbortSignal },
  ): Promise<FileValidationResult> {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return {
        isValid: false,
        error: `MIME type ${mimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    const detected = await this.fileTypeService.detect(buffer, { signal: options?.signal });

    // Markdown has no magic bytes; allow text/markdown when detected is text/plain or undefined
    if (
      (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') &&
      (!detected || detected.mime === 'text/plain')
    ) {
      return { isValid: true };
    }

    if (detected && detected.mime !== mimeType) {
      if (detected.mime === 'application/pdf' && mimeType === 'application/x-pdf') {
        return { isValid: true };
      }
      return {
        isValid: false,
        error: `File signature does not match declared MIME type. Detected: ${detected.mime}, declared: ${mimeType}`,
      };
    }

    return { isValid: true };
  }
}
