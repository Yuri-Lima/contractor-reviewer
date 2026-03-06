/** LLM provider identifiers */
export const LlmProviderId = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
} as const;

export type LlmProviderId = (typeof LlmProviderId)[keyof typeof LlmProviderId];

export const LLM_PROVIDER_IDS: LlmProviderId[] = Object.values(LlmProviderId);

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
}

export interface StreamErrorChunk {
  type: 'error';
  message: string;
}

export type StreamEvent = StreamChunk | StreamDoneChunk | StreamErrorChunk;
