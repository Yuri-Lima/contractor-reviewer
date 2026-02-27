/**
 * TTS and chat response constants (const objects avoid CommonJS/ESM interop issues).
 * Single source of truth for type-safe provider IDs and response modes.
 * Exported with "Values" suffix to avoid name clash with types in types/tts.ts.
 */

/** Chat response display mode - use const object instead of enum for Nx/Angular lazy chunks */
export const ChatResponseModeValues = {
  TextOnly: 'text_only',
  AudioOnly: 'audio_only',
  AudioAndText: 'audio_and_text',
} as const;

/** Supported TTS provider identifiers - use const object instead of enum */
export const TtsProviderIdValues = {
  ReplicateXtts: 'replicate_xtts',
  Huggingface: 'huggingface',
  OpenAI: 'openai',
  ElevenLabs: 'elevenlabs',
} as const;
