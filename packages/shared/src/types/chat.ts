import { Citation } from './common';
import type { LegalAnswer } from './legal-review';
import type { NotFoundReason } from './llm';

// ---------------------------------------------------------------------------
// Dev-mode retrieval diagnostics
// ---------------------------------------------------------------------------

/** RAG retrieval statistics surfaced in the dev-mode prepare payload. */
export interface ChatPrepareRetrievalStats {
  documentChunksRetrieved: number;
  documentChunksKept: number;
  legalChunksRetrieved: number;
  legalChunksKept: number;
  similarityFloor: number;
  similarityFloorFallback: number;
  fallbackUsed: boolean;
  topKDocument: number;
  topKLegal: number;
  webSearchTrigger: 'off' | 'fallback' | 'always';
  webResultsCount: number;
  preflightReason: NotFoundReason | null;
  embeddingModel: string;
}

/** Semantic-cache probe result (read-only, does not consume the cache). */
export interface ChatPrepareCacheStatus {
  wouldHitCache: boolean;
  cacheSimilarityThreshold: number;
}

/** Web search result surfaced in the dev-mode prepare payload. */
export interface ChatPrepareWebResult {
  title: string;
  url: string;
  snippet?: string;
}

/** Prompt scope flags active for this request. */
export interface ChatPrepareScopeFlags {
  includeGlobal: boolean;
  includeWorkspace: boolean;
  includeDocument: boolean;
}

/** Per-step latency breakdown (milliseconds). */
export interface ChatPrepareTimings {
  embeddingMs: number;
  documentSearchMs: number;
  legalSearchMs: number;
  webSearchMs?: number;
  promptAssemblyMs: number;
  totalMs: number;
}

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
  clauseNumber?: string;
  headingPath?: string[];
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
  /** Resolved LLM provider ID (e.g. 'openai', 'anthropic', 'xai'). */
  provider?: string;
  /** Retrieval pipeline statistics for dev-mode diagnostics. */
  retrievalStats?: ChatPrepareRetrievalStats;
  /** Web search results (separate from prompt text for inspection). */
  webSearchResults?: ChatPrepareWebResult[];
  /** Document + thread memory injected into context. Null when no memory exists. */
  memoryContext?: string | null;
  /** Read-only cache probe: whether the question would have been served from semantic cache. */
  cacheStatus?: ChatPrepareCacheStatus;
  /** Which prompt scopes were active for this request. */
  scopeFlags?: ChatPrepareScopeFlags;
  /** Per-step latency breakdown. */
  timings?: ChatPrepareTimings;
}

/** Response from POST /chat/prepare */
export interface ChatPrepareResponse {
  requestId: string;
  payload: ChatPreparePayload;
}

