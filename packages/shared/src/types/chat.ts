import { Citation } from './common';

export interface ChatMessage {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  question: string;
  answerText: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  citations: Citation[] | null;
  notFound: boolean;
  jurisdiction: string | null;
  createdAt: string;
}

export interface ChatRequest {
  question: string;
  language?: string; // ISO 639-1 code (en, es, pt-BR, de)
  forceFresh?: boolean; // Bypass cache and get fresh RAG response
}

export interface ChatResponse {
  answerText: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
  fromCache?: boolean; // True when response was served from semantic cache
}
