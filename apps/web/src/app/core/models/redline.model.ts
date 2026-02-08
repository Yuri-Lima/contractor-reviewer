export enum RedlinePlaybook {
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  CLIENT_FRIENDLY = 'client-friendly',
}

export interface DiffBlock {
  id: string;
  type: 'equal' | 'add' | 'remove';
  text: string;
}

export interface Citation {
  kind: 'contract';
  file?: string;
  page?: number;
  spanId?: string;
  quoteSnippet?: string;
}

export interface LegalCitation {
  kind: 'legal';
  source?: string;
  section?: string;
  url?: string;
}

export interface RedlineChange {
  section: string;
  originalText: string;
  suggestedText: string;
  diffBlocks: DiffBlock[];
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  legalCitations: LegalCitation[];
  notFound: boolean;
}

export interface RedlineRequest {
  selectedText: string;
  playbook: RedlinePlaybook;
  instructions?: string;
  objective?: string;
  pageNumber?: number;
  spanId?: string;
  language?: string; // ISO 639-1 code (en, es, pt-BR, de)
  startIndex?: number; // Character position in full document (optional)
  endIndex?: number; // Character position in full document (optional)
}

export interface RedlineResponse {
  versionId: string;
  changes: RedlineChange[];
  playbook: RedlinePlaybook;
  createdAt: string;
}

export interface Decision {
  blockId: string;
  decision: 'accept' | 'reject';
  userId: string;
  timestamp: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  versionNumber: number;
  playbook: RedlinePlaybook | null;
  instructions: string | null;
  changes: RedlineChange[] | null;
  decisions: Decision[] | null;
  parentVersionId: string | null;
  prompt: string | null;
  createdAt: string;
}
