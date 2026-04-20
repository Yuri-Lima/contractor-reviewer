/** LLM provider identifiers */
export const LLM_PROVIDER_ID = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
  XAI: 'xai',
} as const;

export type LlmProviderId = (typeof LLM_PROVIDER_ID)[keyof typeof LLM_PROVIDER_ID];

export const LLM_PROVIDER_IDS: LlmProviderId[] = Object.values(LLM_PROVIDER_ID);

/** Type guard for LlmProviderId */
export function isLlmProviderId(value: string | null | undefined): value is LlmProviderId {
  return value != null && LLM_PROVIDER_IDS.includes(value as LlmProviderId);
}

/** Message format for LLM completion (compatible with OpenAI/Anthropic) */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Options for LLM completion */
export interface LlmCompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Stream chunk types for SSE */
export interface StreamChunk {
  type: 'chunk';
  content: string;
}

import type { Citation } from './common';
import type { LegalAnswer } from './legal-review';

/**
 * Why retrieval surfaced no usable context. Surfaced alongside `notFound`
 * so the UI can render a specific message (still indexing, no chunks,
 * embeddings pending) instead of a generic "NOT FOUND".
 *
 * - `no_chunks`         — the document has zero chunk rows (parsing/chunking has not run or failed).
 * - `embeddings_pending` — chunks exist but at least one is missing an embedding (embed-chunks job still running).
 * - `below_floor`       — chunks + embeddings exist, but none crossed the configured similarity floor.
 */
export type NotFoundReason = 'no_chunks' | 'embeddings_pending' | 'below_floor';

export interface StreamDoneChunk {
  type: 'done';
  answerText: string;
  /** Present in legal-review mode. UI prefers this over answerText when set. */
  legalAnswer?: LegalAnswer;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
  /** When `notFound === true`, indicates the diagnostic root cause for the UI. */
  notFoundReason?: NotFoundReason;
  fromCache: boolean;
}

export interface StreamErrorChunk {
  type: 'error';
  message: string;
}

/**
 * Progress event emitted during the RAG preparation phase so the UI can
 * show what's happening ("Searching documents...", "Generating...") instead
 * of a blank spinner while the SSE connection is open but silent.
 */
export interface StreamStatusChunk {
  type: 'status';
  phase: 'embedding' | 'searching' | 'web-search' | 'generating';
}

/**
 * Structured legal-answer event emitted instead of token-by-token chunks
 * when `legalReviewMode` is on (structured-output APIs cannot safely stream
 * partial JSON). Sent as a single message just before `StreamDoneChunk`.
 */
export interface StreamLegalAnswerChunk {
  type: 'legal-answer';
  answer: LegalAnswer;
}

export type StreamEvent =
  | StreamChunk
  | StreamStatusChunk
  | StreamLegalAnswerChunk
  | StreamDoneChunk
  | StreamErrorChunk;
