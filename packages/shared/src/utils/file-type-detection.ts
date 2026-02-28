/**
 * Viewer format utilities for routing documents to the correct viewer.
 *
 * getViewerFormat maps detected type or metadata to a viewer format.
 * Content-based detection (detectFileType) lives in the API package
 * since it uses file-type which is Node-only.
 */

import {
  ALLOWED_EXTENSIONS,
  AUDIO_ALLOWED_EXTENSIONS,
  AUDIO_ALLOWED_MIME_TYPES,
  IMAGE_ASSET_EXTENSIONS,
} from '../constants';

export type ViewerFormat =
  | 'pdf'
  | 'image'
  | 'text'
  | 'docx'
  | 'doc'
  | 'audio'
  | 'unsupported';

/**
 * Maps detected type or metadata to a viewer format for routing.
 *
 * @param detected - Result from content-based detection, or undefined
 * @param meta - fileName and mimeType from document metadata
 */
export function getViewerFormat(
  detected: { ext: string; mime: string } | undefined,
  meta: { fileName: string; mimeType: string }
): ViewerFormat {
  const ext = detected?.ext ?? meta.fileName.toLowerCase().split('.').pop() ?? '';
  const mime = (detected?.mime ?? meta.mimeType ?? '').toLowerCase().split(';')[0].trim();
  const extWithDot = ext.startsWith('.') ? ext : `.${ext}`;

  if (detected) {
    if (
      ext === 'pdf' ||
      mime === 'application/pdf' ||
      mime === 'application/x-pdf'
    ) {
      return 'pdf';
    }
    if (
      ['docx', 'doc'].includes(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      return ext === 'doc' || mime === 'application/msword' ? 'doc' : 'docx';
    }
    if (
      ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ||
      mime.startsWith('image/')
    ) {
      return 'image';
    }
    if (
      ['txt', 'md'].includes(ext) ||
      mime === 'text/plain' ||
      mime === 'text/markdown' ||
      mime === 'text/x-markdown'
    ) {
      return 'text';
    }
    if (
      (AUDIO_ALLOWED_EXTENSIONS as readonly string[]).includes(extWithDot) ||
      (AUDIO_ALLOWED_MIME_TYPES as readonly string[]).some((a) => a === mime) ||
      mime === 'video/mp4' ||
      mime === 'video/mpeg'
    ) {
      return 'audio';
    }
  }

  // Fallback to metadata when detection returned undefined
  if (
    (ALLOWED_EXTENSIONS as readonly string[]).includes(
      extWithDot as (typeof ALLOWED_EXTENSIONS)[number]
    )
  ) {
    if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
    if (ext === 'docx' || mime.includes('wordprocessingml')) return 'docx';
    if (ext === 'doc' || mime.includes('msword')) return 'doc';
    if (['png', 'jpg', 'jpeg'].includes(ext) || mime.startsWith('image/')) return 'image';
    if (['txt', 'md'].includes(ext) || mime.startsWith('text/')) return 'text';
  }

  if (
    (AUDIO_ALLOWED_EXTENSIONS as readonly string[]).includes(extWithDot) ||
    mime.startsWith('audio/') ||
    mime === 'video/mp4' ||
    mime === 'video/mpeg'
  ) {
    return 'audio';
  }

  if (
    (IMAGE_ASSET_EXTENSIONS as readonly string[]).includes(
      extWithDot as (typeof IMAGE_ASSET_EXTENSIONS)[number]
    )
  ) {
    return 'image';
  }

  return 'unsupported';
}
