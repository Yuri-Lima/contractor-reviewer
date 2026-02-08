export interface ChatMessage {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  question: string;
  answerText: string | null;
  confidence: string | null;
  citations: Citation[] | null;
  notFound: boolean;
  jurisdiction: string | null;
  createdAt: string;
}

export interface Citation {
  type: 'contract' | 'legal';
  fileName?: string;
  pageNumber?: number;
  paragraph?: string;
  quoteSnippet?: string;
  sourceName?: string;
  section?: string;
  url?: string;
}

export interface ChatRequest {
  question: string;
  language?: string; // ISO 639-1 code (en, es, pt-BR, de)
}

export interface ChatResponse {
  answerText: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
}
