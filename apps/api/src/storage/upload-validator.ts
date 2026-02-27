import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@contractai-review/shared';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export class UploadValidator {
  private static readonly MAX_FILE_SIZE = MAX_FILE_SIZE_BYTES; // 50MB

  /**
   * Validate file extension
   */
  static validateExtension(fileName: string): FileValidationResult {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate file size
   */
  static validateSize(fileSize: number): FileValidationResult {
    if (fileSize > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    if (fileSize === 0) {
      return {
        isValid: false,
        error: 'File is empty',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate MIME type (don't trust Content-Type header, use file signature)
   */
  static validateMimeType(mimeType: string, buffer: Buffer): FileValidationResult {
    // Basic MIME type check
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return {
        isValid: false,
        error: `MIME type ${mimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    // File signature (magic number) validation for security
    const detectedMimeType = this.detectMimeTypeFromBuffer(buffer);

    // Markdown has no magic bytes; it is plain text. Allow text/markdown and text/x-markdown
    // when detected type is text/plain or null (no binary signature).
    if (
      (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') &&
      (detectedMimeType === 'text/plain' || detectedMimeType === null)
    ) {
      return { isValid: true };
    }
    
    if (detectedMimeType && detectedMimeType !== mimeType) {
      // Allow application/x-pdf when buffer is detected as PDF (same format)
      if (
        detectedMimeType === 'application/pdf' &&
        mimeType === 'application/x-pdf'
      ) {
        return { isValid: true };
      }
      return {
        isValid: false,
        error: `File signature does not match declared MIME type. Detected: ${detectedMimeType}, declared: ${mimeType}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Detect MIME type from file buffer (magic numbers)
   */
  private static detectMimeTypeFromBuffer(buffer: Buffer): string | null {
    if (buffer.length < 4) {
      return null;
    }

    // PDF: %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'application/pdf';
    }

    // PNG: PNG signature
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // DOC (OLE/CFB): D0 CF 11 E0 A1 B1 1A E1
    if (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0
    ) {
      return 'application/msword';
    }

    // DOCX: PK (ZIP signature, DOCX is a ZIP file)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      // Check if it's a DOCX by looking for word/document.xml in ZIP structure
      // This is a simplified check - in production, you might want to use a library
      const bufferStr = buffer.toString('binary', 0, Math.min(1024, buffer.length));
      if (bufferStr.includes('word/document.xml')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
    }

    // Plain text: Check if it's mostly ASCII
    if (buffer.length > 0) {
      let asciiCount = 0;
      for (let i = 0; i < Math.min(512, buffer.length); i++) {
        if (buffer[i] >= 0x20 && buffer[i] <= 0x7e) {
          asciiCount++;
        }
      }
      if (asciiCount / Math.min(512, buffer.length) > 0.9) {
        return 'text/plain';
      }
    }

    return null;
  }

  /**
   * Validate all file properties
   */
  static validateFile(
    fileName: string,
    mimeType: string,
    fileSize: number,
    buffer: Buffer,
  ): FileValidationResult {
    // Validate extension
    const extensionCheck = this.validateExtension(fileName);
    if (!extensionCheck.isValid) {
      return extensionCheck;
    }

    // Validate size
    const sizeCheck = this.validateSize(fileSize);
    if (!sizeCheck.isValid) {
      return sizeCheck;
    }

    // Validate MIME type
    const mimeCheck = this.validateMimeType(mimeType, buffer);
    if (!mimeCheck.isValid) {
      return mimeCheck;
    }

    return { isValid: true };
  }
}
