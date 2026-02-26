import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TRANSCRIPTION_PROVIDER_IDS, type TranscriptionProviderId } from '@contractai-review/shared';
import type { ITranscriptionProvider } from './interfaces/transcription-provider.interface';
import { HuggingFaceTranscriptionProvider } from './providers/huggingface.provider';
import { OpenAITranscriptionProvider } from './providers/openai.provider';

/** Map of implemented providers. Add new providers here when implemented. */
const PROVIDER_FACTORIES: Partial<
  Record<TranscriptionProviderId, (config: ConfigService) => ITranscriptionProvider>
> = {
  huggingface: (config) => new HuggingFaceTranscriptionProvider(config),
  openai: (config) => new OpenAITranscriptionProvider(config),
};

@Injectable()
export class TranscriptionProviderRegistry {
  private readonly providers = new Map<TranscriptionProviderId, ITranscriptionProvider>();

  constructor(private configService: ConfigService) {
    this.registerAvailableProviders();
  }

  private registerAvailableProviders(): void {
    for (const id of TRANSCRIPTION_PROVIDER_IDS) {
      try {
        const factory = PROVIDER_FACTORIES[id];
        if (factory) {
          this.providers.set(id, factory(this.configService));
        }
      } catch {
        // Skip providers that fail to initialize (e.g. missing env)
      }
    }
  }

  get(providerId: string): ITranscriptionProvider | undefined {
    return this.providers.get(providerId as TranscriptionProviderId);
  }

  getAvailableIds(): TranscriptionProviderId[] {
    return Array.from(this.providers.keys());
  }

  getDefaultProviderId(): TranscriptionProviderId {
    const env = this.configService.get<string>('TRANSCRIPTION_PROVIDER', 'huggingface');
    if (TRANSCRIPTION_PROVIDER_IDS.includes(env as TranscriptionProviderId) && this.providers.has(env as TranscriptionProviderId)) {
      return env as TranscriptionProviderId;
    }
    const first = this.providers.keys().next().value;
    if (first) return first;
    throw new Error(
      'No transcription provider registered. Add API keys in Workspace Settings → Voice.',
    );
  }
}
