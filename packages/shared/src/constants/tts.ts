/**
 * TTS provider constants.
 * Shared across API and web apps for type-safe, non-hardcoded provider options.
 */
import { TtsProviderId } from '../types/tts';

export interface TtsProviderOption {
  id: TtsProviderId;
  labelKey: string;
}

export const TTS_PROVIDER_OPTIONS: readonly TtsProviderOption[] = [
  { id: TtsProviderId.ReplicateXtts, labelKey: 'tts.replicateXtts' },
  { id: TtsProviderId.Huggingface, labelKey: 'tts.huggingface' },
  { id: TtsProviderId.OpenAI, labelKey: 'tts.openai' },
  { id: TtsProviderId.ElevenLabs, labelKey: 'tts.elevenlabs' },
] as const;

/** OpenAI TTS voice options (for future voice selection) */
export const OPENAI_TTS_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const;

export type OpenAITtsVoice = (typeof OPENAI_TTS_VOICES)[number];
