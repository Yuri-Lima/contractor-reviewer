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
  files?: DocumentFile[];
  jobs?: DocumentJob[];
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

export interface FileContentResponse {
  content: string;
  fileName: string;
  parsedBy?: string;
}
