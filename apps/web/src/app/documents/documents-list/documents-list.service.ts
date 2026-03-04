import { Injectable, inject } from '@angular/core';
import { CreateDocumentRequest } from '@contractai-review/shared';
import { ApiService } from '../../core/services/api.service';
import type { IDocumentsListService } from './documents-list.service.interface';

const DEFAULT_CONTEXT_MARKDOWN_MAX_BYTES = 51200;

@Injectable()
export class DocumentsListServiceImpl implements IDocumentsListService {
  private readonly api = inject(ApiService);

  loadDocuments(workspaceId: string) {
    return this.api.getDocuments(workspaceId);
  }

  createDocument(workspaceId: string, params: CreateDocumentRequest) {
    return this.api.createDocument(workspaceId, params);
  }

  generatePrompt(
    workspaceId: string,
    title: string,
    description: string,
    contextMarkdown?: string,
  ) {
    return this.api.generateDocumentPrompt(
      workspaceId,
      title,
      description,
      contextMarkdown,
    );
  }

  updateDocumentTitle(workspaceId: string, docId: string, title: string) {
    return this.api.updateDocument(workspaceId, docId, { title });
  }

  deleteDocument(workspaceId: string, docId: string) {
    return this.api.deleteDocument(workspaceId, docId);
  }

  readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  isContextMarkdownExceeded(
    content: string,
    maxBytes = DEFAULT_CONTEXT_MARKDOWN_MAX_BYTES,
  ): boolean {
    return new Blob([content]).size > maxBytes;
  }
}
