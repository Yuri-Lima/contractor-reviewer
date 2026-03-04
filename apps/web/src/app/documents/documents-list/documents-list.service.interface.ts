import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Document, CreateDocumentRequest } from '@contractai-review/shared';
import { GeneratePromptResponse } from '@contractai-review/shared';

/**
 * Service contract for documents list feature.
 * Use InjectionToken + interface for testability and DI swapping.
 */
export interface IDocumentsListService {
  loadDocuments(workspaceId: string): Observable<Document[]>;
  createDocument(
    workspaceId: string,
    params: CreateDocumentRequest,
  ): Observable<Document>;
  generatePrompt(
    workspaceId: string,
    title: string,
    description: string,
    contextMarkdown?: string,
  ): Observable<GeneratePromptResponse>;
  updateDocumentTitle(
    workspaceId: string,
    docId: string,
    title: string,
  ): Observable<Document>;
  deleteDocument(workspaceId: string, docId: string): Observable<void>;
  readFileAsText(file: File): Promise<string>;
  isContextMarkdownExceeded(content: string, maxBytes?: number): boolean;
}

export const DOCUMENTS_LIST_SERVICE = new InjectionToken<IDocumentsListService>(
  'DocumentsListService',
);
