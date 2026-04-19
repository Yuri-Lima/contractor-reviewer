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

export interface StreamDoneChunk {
  type: 'done';
  answerText: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
  fromCache: boolean;
}

export interface StreamErrorChunk {
  type: 'error';
  message: string;
}

export type StreamEvent = StreamChunk | StreamDoneChunk | StreamErrorChunk;
