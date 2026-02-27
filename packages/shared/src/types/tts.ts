/**
 * TTS provider and chat response types.
 * Re-exports enums and provides type guards and helper arrays.
 */
import {
  ChatResponseModeValues,
  TtsProviderIdValues,
} from '../enums/tts.enum';

export const ChatResponseMode = ChatResponseModeValues;
export const TtsProviderId = TtsProviderIdValues;

export type ChatResponseMode = (typeof ChatResponseModeValues)[keyof typeof ChatResponseModeValues];
export type TtsProviderId = (typeof TtsProviderIdValues)[keyof typeof TtsProviderIdValues];

/** Array of all chat response modes (for iteration, options, etc.) */
export const CHAT_RESPONSE_MODES = Object.values(ChatResponseModeValues) as ChatResponseMode[];

/** Array of all TTS provider IDs (for iteration, options, etc.) */
export const TTS_PROVIDER_IDS = Object.values(TtsProviderIdValues) as TtsProviderId[];

/** Type guard to check if a string is a valid TtsProviderId */
export function isTtsProviderId(value: string): value is TtsProviderId {
  return Object.values(TtsProviderIdValues).includes(value as TtsProviderId);
}

/** Type guard to check if a string is a valid ChatResponseMode */
export function isChatResponseMode(value: string): value is ChatResponseMode {
  return Object.values(ChatResponseModeValues).includes(value as ChatResponseMode);
}

/** Provider-specific config (plan, output format, etc.). Extensible per provider. */
export interface TtsProviderConfig {
  /** ElevenLabs: 'free' | 'starter' | 'pro' | 'scale' | 'business' - drives output format */
  plan?: string;
  /** Explicit output format override (e.g. 'mp3_44100_128' | 'wav_44100'). Overrides plan-derived default. */
  outputFormat?: string;
  [key: string]: unknown;
}

/** ElevenLabs plan values - used for output format selection */
export const ELEVENLABS_PLANS = ['free', 'starter', 'pro', 'scale', 'business'] as const;
export type ElevenLabsPlan = (typeof ELEVENLABS_PLANS)[number];
