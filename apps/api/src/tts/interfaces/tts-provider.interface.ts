import type { TtsProviderId, TtsProviderConfig } from '@contractai-review/shared';

export interface TtsSynthesizeOptions {
  language?: string;
  /** Workspace-decrypted API key */
  apiKey?: string;
  /** Provider-specific voice (e.g. OpenAI coral) */
  voice?: string;
  /** Provider-specific config from workspace (plan, output format, etc.) */
  providerConfig?: TtsProviderConfig;
}

export interface ITtsProvider {
  readonly id: TtsProviderId;
  /** Synthesize text to audio. Returns WAV buffer. */
  synthesize(text: string, options?: TtsSynthesizeOptions): Promise<Buffer>;
}
