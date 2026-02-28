import type { TranscriptionProviderId } from '@contractai-review/shared';
import { Injectable, Logger } from '@nestjs/common';
import { TranscriptionProviderRegistry } from './transcription-provider.registry';
import type { ITranscriptionProvider, TranscriptionResult } from './interfaces/transcription-provider.interface';
import { abortAsPromise } from '../common/utils/abort-promise';

/** Timeout for transcription (Huggingface/OpenAI can be slow; cold starts, long audio). */
const TIMEOUT_MS = 120_000;

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly registry: TranscriptionProviderRegistry) {}

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: {
      language?: string;
      providerId?: TranscriptionProviderId;
      apiKey?: string;
      signal?: AbortSignal;
    },
  ): Promise<TranscriptionResult> {
    let provider: ITranscriptionProvider;
    if (options?.providerId) {
      const p = this.registry.get(options.providerId);
      if (p) {
        provider = p;
      } else {
        provider = this.registry.get(this.registry.getDefaultProviderId())!;
      }
    } else {
      provider = this.registry.get(this.registry.getDefaultProviderId())!;
    }

    const timeoutPromise = new Promise<TranscriptionResult>((_, reject) =>
      setTimeout(() => {
        const err = new Error(
          `Transcription timeout after ${TIMEOUT_MS}ms (provider=${provider.id}, audioSize=${audioBuffer.length})`,
        );
        this.logger.warn(
          `Transcription timeout: provider=${provider.id} audioSize=${audioBuffer.length} mimeType=${mimeType}`,
        );
        reject(err);
      }, TIMEOUT_MS),
    );

    const transcribePromise = provider.transcribe(audioBuffer, mimeType, {
      language: options?.language,
      apiKey: options?.apiKey,
      signal: options?.signal,
    });

    const abortPromise = abortAsPromise(options?.signal);

    const result = await Promise.race([
      transcribePromise,
      abortPromise,
      timeoutPromise,
    ]);
    this.logger.debug(
      `Transcription completed (provider=${provider.id}, size=${audioBuffer.length})`,
    );
    return result;
  }

  getAvailableProviderIds(): TranscriptionProviderId[] {
    return this.registry.getAvailableIds();
  }

  getDefaultProviderId(): TranscriptionProviderId {
    return this.registry.getDefaultProviderId();
  }
}
