import {
  AUDIO_ALLOWED_EXTENSIONS,
  AUDIO_ALLOWED_MIME_TYPES,
  AUDIO_MAX_SIZE_BYTES,
} from '@contractai-review/shared';

export { AUDIO_ALLOWED_EXTENSIONS, AUDIO_ALLOWED_MIME_TYPES, AUDIO_MAX_SIZE_BYTES };

export interface AudioValidationResult {
  isValid: boolean;
  error?: string;
}

export class AudioValidator {
  static validateExtension(fileName: string): AudioValidationResult {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.') || 0);
    if (!(AUDIO_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        isValid: false,
        error: `File extension ${ext} is not allowed. Allowed: ${AUDIO_ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }
    return { isValid: true };
  }

  static validateSize(fileSize: number): AudioValidationResult {
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

  static validateMimeType(mimeType: string, buffer: Buffer): AudioValidationResult {
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
    const detected = this.detectMimeFromBuffer(buffer);
    if (detected) {
      const detectedAllowed = (AUDIO_ALLOWED_MIME_TYPES as readonly string[]).some(
        (allowed) => allowed.toLowerCase() === detected,
      );
      if (!detectedAllowed) {
        return {
          isValid: false,
          error: `File signature does not match allowed audio format. Detected: ${detected}`,
        };
      }
    }
    return { isValid: true };
  }

  /**
   * Returns the MIME type to use for downstream processing.
   * Uses detected format from buffer when available; otherwise the declared base type.
   */
  static getEffectiveMimeType(mimeType: string, buffer: Buffer): string {
    const detected = this.detectMimeFromBuffer(buffer);
    if (detected) {
      return detected;
    }
    return mimeType.split(';')[0].trim().toLowerCase();
  }

  private static detectMimeFromBuffer(buffer: Buffer): string | null {
    if (buffer.length < 8) return null;
    // WebM/MKV: 0x1A 0x45 0xDF 0xA3
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return 'audio/webm';
    }
    // WAV: RIFF
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return 'audio/wav';
    }
    // MP3: ID3 or FF FB/FA
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa))
    ) {
      return 'audio/mpeg';
    }
    // MP4/M4A: ftyp — use audio/m4a (HuggingFace ASR accepts m4a, not mp4)
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return 'audio/m4a';
    }
    return null;
  }

  static validate(
    fileName: string,
    mimeType: string,
    fileSize: number,
    buffer: Buffer,
  ): AudioValidationResult {
    const extCheck = this.validateExtension(fileName);
    if (!extCheck.isValid) return extCheck;
    const sizeCheck = this.validateSize(fileSize);
    if (!sizeCheck.isValid) return sizeCheck;
    const mimeCheck = this.validateMimeType(mimeType, buffer);
    if (!mimeCheck.isValid) return mimeCheck;
    return { isValid: true };
  }
}
