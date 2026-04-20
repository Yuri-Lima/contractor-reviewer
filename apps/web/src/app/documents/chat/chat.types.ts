import type { Citation, LegalAnswer, NotFoundReason } from '@contractai-review/shared';

/** Audio state for a chat message when TTS is enabled */
export type ChatMessageAudioState = 'none' | 'synthesizing' | 'ready' | 'playing';

/** Extended chat message with optional audio playback state */
export interface ChatMessageWithAudio {
  question: string;
  answerText?: string;
  /**
   * Structured legal-grade answer (Phase 1 of legal-review pipeline).
   * When present, the chat message renders the LegalAnswerComponent instead of the free-text/markdown view.
   */
  legalAnswer?: LegalAnswer;
  confidence?: string;
  citations?: Citation[];
  audioState?: ChatMessageAudioState;
  audioUrl?: string;
  fromCache?: boolean;
  /** True while streaming response chunks */
  streaming?: boolean;
  /** True when the RAG pipeline produced no usable context for this answer. */
  notFound?: boolean;
  /**
   * Diagnostic root cause when `notFound === true`. Lets the UI render a
   * specific message ("still indexing", "no chunks", "below floor") instead
   * of a generic NOT FOUND.
   */
  notFoundReason?: NotFoundReason;
}

/** Chat thread from API (for picker) */
export interface ChatThreadInfo {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}
