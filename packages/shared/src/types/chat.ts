import { Citation } from './common';
import type { LegalAnswer } from './legal-review';
import type { NotFoundReason } from './llm';

export interface ChatThread {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  role: 'user' | 'assistant';
  question: string;
  answerText: string | null;
  /** Structured legal-grade answer when LEGAL_REVIEW_MODE is enabled for the workspace. Null otherwise. */
  legalAnswer?: LegalAnswer | null;
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
  threadId?: string; // Optional; auto-create thread if omitted
}

export interface ChatResponse {
  answerText: string;
  /**
   * Structured legal-grade answer (Phase 1 of legal-review pipeline).
   * Present when the workspace has `legalReviewMode !== false`. When present,
   * `answerText` is set to `legalAnswer.freeText ?? <one-line summary>` so legacy renderers still work.
   */
  legalAnswer?: LegalAnswer;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
  /** When `notFound === true`, indicates the diagnostic root cause for the UI. */
  notFoundReason?: NotFoundReason;
  fromCache?: boolean; // True when response was served from semantic cache
}

/** Display-safe document chunk for LLM payload preview (dev mode) */
export interface ChatPrepareDocumentChunk {
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
  documentChunks: ChatPrepareDocumentChunk[];
  legalChunks: ChatPrepareLegalChunk[];
  question: string;
  /** Resolved model. May be `null` to mean "let the adapter use its own default" (legal-review mode + no LEGAL_REVIEW_MODEL_<PROVIDER> env). */
  model: string | null;
  temperature: number;
  maxTokens: number;
  /** When true, executePreparedChat will call `completeStructured<LegalAnswer>` instead of `complete`/`completeStream`. */
  legalReviewMode?: boolean;
}

/** Response from POST /chat/prepare */
export interface ChatPrepareResponse {
  requestId: string;
  payload: ChatPreparePayload;
}

