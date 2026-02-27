/**
 * Single source of truth for document file upload validation.
 * Used by API upload validator and frontend file input.
 */
export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
] as const;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf', // Alternative PDF MIME type used by some browsers/systems
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'image/png',
  'image/jpeg',
] as const;

/** HTML accept attribute value for file inputs (e.g. .pdf,.doc,.docx,.txt,.md,...) */
export const FILE_INPUT_ACCEPT = ALLOWED_EXTENSIONS.join(',');

/** Max size per file (50MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Max total batch size when selecting multiple files (100MB) */
export const MAX_BATCH_SIZE_BYTES = 100 * 1024 * 1024;

/** Max number of files in a batch upload */
export const MAX_BATCH_FILE_COUNT = 20;
