/**
 * Audio constants shared across API and web apps.
 * Used for transcription upload validation and file naming.
 */

export const AUDIO_ALLOWED_EXTENSIONS = [
  '.webm',
  '.wav',
  '.mp3',
  '.m4a',
  '.mp4',
  '.mpga',
  '.mpeg',
] as const;

export const AUDIO_ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp3',
  'video/mp4',
] as const;

export const AUDIO_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/** Maps MIME type to file extension for audio uploads. */
export const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp3': 'mp3',
  'video/mp4': 'm4a',
};

/**
 * Returns the file extension for an audio MIME type.
 * Falls back to 'webm' if the MIME type is not recognized.
 */
export function getAudioExtensionFromMime(mimeType: string): string {
  const baseType = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_TO_EXTENSION[baseType] ?? 'webm';
}
