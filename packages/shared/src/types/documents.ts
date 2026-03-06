import { DocumentStatus, JurisdictionStatus } from '../enums/document.enum';
import { FileStatus } from '../enums/file.enum';
import { JobType, JobStatus } from '../enums/job.enum';

/** Jurisdiction candidate with evidence for user override */
export interface JurisdictionCandidate {
  jurisdiction: string;
  status: 'explicit' | 'inferred';
  confidence: number;
  evidenceCount: number;
  fileNames: string[];
  snippets: string[];
}

export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: DocumentStatus;
  resolvedJurisdiction?: string;
  jurisdictionStatus?: JurisdictionStatus;
  /** List of jurisdiction candidates with evidence for user override */
  jurisdictionCandidates?: JurisdictionCandidate[] | null;
  jurisdictionReasoning?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Include document prompts when building combined prompt (additive model) */
  promptScopeIncludeDocument?: boolean;
  /** Prompt category (e.g. legal-law). When Legal/Law + resolvedJurisdiction, enables Legal RAG. */
  promptCategoryId?: string | null;
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
  /** If provided, upserts chat.system document prompt after creation */
  documentChatSystemPrompt?: string;
  /** If provided, upserts all 7 document prompts from the selected category */
  promptCategoryId?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  /** Include document prompts when building combined prompt */
  promptScopeIncludeDocument?: boolean;
  /** Prompt category (e.g. legal-law). Use null to clear. */
  promptCategoryId?: string | null;
  /** Override AI-chosen jurisdiction. Use null to clear. */
  resolvedJurisdiction?: string | null;
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
