import { of } from 'rxjs';
import { Document, DocumentStatus } from '@contractai-review/shared';
import type { IDocumentsListService } from './documents-list.service.interface';

const CONTEXT_MARKDOWN_MAX_BYTES = 51200;

const mockDocument: Document = {
  id: '1',
  workspaceId: 'ws-1',
  title: 'Test',
  status: DocumentStatus.AVAILABLE,
  createdAt: '',
  updatedAt: '',
};

describe('IDocumentsListService', () => {
  const mockService: IDocumentsListService = {
    loadDocuments: () => of([]),
    createDocument: () => of(mockDocument),
    generatePrompt: () => of({ generatedPrompt: '' }),
    updateDocumentTitle: () => of(mockDocument),
    deleteDocument: () => of(undefined),
    readFileAsText: () => Promise.resolve(''),
    isContextMarkdownExceeded: (content: string, maxBytes = CONTEXT_MARKDOWN_MAX_BYTES) =>
      new Blob([content]).size > maxBytes,
  };

  it('should satisfy interface contract', () => {
    expect(mockService.loadDocuments).toBeDefined();
    expect(mockService.createDocument).toBeDefined();
    expect(mockService.generatePrompt).toBeDefined();
    expect(mockService.updateDocumentTitle).toBeDefined();
    expect(mockService.deleteDocument).toBeDefined();
    expect(mockService.readFileAsText).toBeDefined();
    expect(mockService.isContextMarkdownExceeded).toBeDefined();
  });

  it('should return false when content is within 50KB limit', () => {
    expect(mockService.isContextMarkdownExceeded('')).toBe(false);
    expect(mockService.isContextMarkdownExceeded('short')).toBe(false);
    expect(mockService.isContextMarkdownExceeded('x'.repeat(51200))).toBe(false);
  });

  it('should return true when content exceeds 50KB limit', () => {
    expect(mockService.isContextMarkdownExceeded('x'.repeat(51201))).toBe(true);
  });

  it('should respect custom maxBytes', () => {
    expect(mockService.isContextMarkdownExceeded('abc', 2)).toBe(true);
    expect(mockService.isContextMarkdownExceeded('a', 2)).toBe(false);
  });
});
