import type { TranscriptionProviderId } from '@contractai-review/shared';

export interface TranscriptionOptions {
  language?: string;
  /** API key override (from workspace settings). When set, used instead of env. */
  apiKey?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface ITranscriptionProvider {
  readonly id: TranscriptionProviderId;
  transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
}

export interface TranscriptionResult {
  text: string;
  provider?: string;
}
