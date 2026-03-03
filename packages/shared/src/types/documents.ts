import { DocumentStatus, JurisdictionStatus } from '../enums/document.enum';
import { FileStatus } from '../enums/file.enum';
import { JobType, JobStatus } from '../enums/job.enum';

export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: DocumentStatus;
  resolvedJurisdiction?: string;
  jurisdictionStatus?: JurisdictionStatus;
  createdAt: string;
  updatedAt: string;
  /** Include document prompts when building combined prompt (additive model) */
  promptScopeIncludeDocument?: boolean;
  files?: DocumentFile[];
  jobs?: DocumentJob[];
}

export interface DocumentFile {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  detectedExt?: string;
  detectedMime?: string;
  sizeBytes: number;
  status: FileStatus;
  storageKey: string;
  ocrText?: string;
  errorMessage?: string;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentJob {
  id: string;
  documentId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  attempts: number;
  lastError?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title: string;
  description?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  /** Include document prompts when building combined prompt */
  promptScopeIncludeDocument?: boolean;
}

export interface FileContentResponse {
  content: string;
  fileName: string;
  parsedBy?: string;
}

/** Scope for file search: general (all columns) or single column */
export type FileSearchScope = 'all' | 'fileName' | 'mimeType' | 'status' | 'createdAt';

/** Search mode: fuzzy (pg_trgm) or contains (ILIKE) */
export type SearchMode = 'fuzzy' | 'contains';
