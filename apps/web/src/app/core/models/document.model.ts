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
  files?: DocumentFile[];
  jobs?: DocumentJob[];
}

export enum DocumentStatus {
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  ERROR = 'error',
}

export enum JurisdictionStatus {
  EXPLICIT = 'explicit',
  INFERRED = 'inferred',
  UNKNOWN = 'unknown',
}

export interface DocumentFile {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  storageKey: string;
  ocrText?: string;
  createdAt: string;
}

export enum FileStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  ERROR = 'error',
}

export interface DocumentJob {
  id: string;
  documentId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export enum JobType {
  OCR = 'ocr',
  PARSING = 'parsing',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface CreateDocumentRequest {
  title: string;
  description?: string;
}
