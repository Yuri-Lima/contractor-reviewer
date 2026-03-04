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

/** Display-safe contract chunk for LLM payload preview (dev mode) */
export interface ChatPrepareContractChunk {
  text: string;
  pageNumber?: number;
  paragraphId?: string;
  similarity: number;
}

/** Display-safe legal chunk for LLM payload preview (dev mode) */
export interface ChatPrepareLegalChunk {
  text: string;
  sourceName?: string;
  section?: string;
  url?: string;
  similarity: number;
}

/** Full payload shown in dev mode dialog before sending to LLM */
export interface ChatPreparePayload {
  systemPrompt: string;
  userPrompt: string;
  contractChunks: ChatPrepareContractChunk[];
  legalChunks: ChatPrepareLegalChunk[];
  question: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/** Response from POST /chat/prepare */
export interface ChatPrepareResponse {
  requestId: string;
  payload: ChatPreparePayload;
}

/** Request body for POST /chat/execute */
export interface ChatExecuteRequest {
  requestId: string;
}
