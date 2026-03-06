import type { Citation } from '@contractai-review/shared';

/** Audio state for a chat message when TTS is enabled */
export type ChatMessageAudioState = 'none' | 'synthesizing' | 'ready' | 'playing';

/** Extended chat message with optional audio playback state */
export interface ChatMessageWithAudio {
  question: string;
  answerText?: string;
  confidence?: string;
  citations?: Citation[];
  audioState?: ChatMessageAudioState;
  audioUrl?: string;
  fromCache?: boolean;
  /** True while streaming response chunks */
  streaming?: boolean;
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
