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
