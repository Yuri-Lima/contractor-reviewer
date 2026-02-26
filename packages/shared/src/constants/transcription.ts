/**
 * Transcription provider constants.
 * Shared across API and web apps for type-safe, non-hardcoded provider options.
 */
import type { TranscriptionProviderId } from '../types/transcription';

export interface TranscriptionProviderOption {
  id: TranscriptionProviderId;
  labelKey: string;
}

export const TRANSCRIPTION_PROVIDER_OPTIONS: readonly TranscriptionProviderOption[] = [
  { id: 'huggingface', labelKey: 'transcription.huggingface' },
  { id: 'openai', labelKey: 'transcription.openai' },
] as const;
