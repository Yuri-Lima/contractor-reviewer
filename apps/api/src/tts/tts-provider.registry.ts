import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTS_PROVIDER_IDS,
  TtsProviderId,
} from '@contractai-review/shared';
import type { ITtsProvider } from './interfaces/tts-provider.interface';
import { ReplicateXttsAdapter } from './adapters/replicate-xtts.adapter';
import { HuggingFaceTtsAdapter } from './adapters/huggingface.adapter';
import { OpenAITtsAdapter } from './adapters/openai.adapter';
import { ElevenLabsTtsAdapter } from './adapters/elevenlabs.adapter';

/** Cost-friendly order: free first, then paid. */
const FALLBACK_ORDER: TtsProviderId[] = [
  TtsProviderId.Huggingface,
  TtsProviderId.OpenAI,
  TtsProviderId.ElevenLabs,
  TtsProviderId.ReplicateXtts,
];

const PROVIDER_FACTORIES: Partial<
  Record<TtsProviderId, (config: ConfigService) => ITtsProvider | null>
> = {
  [TtsProviderId.Huggingface]: (config) => new HuggingFaceTtsAdapter(config),
  [TtsProviderId.OpenAI]: () => new OpenAITtsAdapter(),
  [TtsProviderId.ElevenLabs]: () => new ElevenLabsTtsAdapter(),
  [TtsProviderId.ReplicateXtts]: (config) => {
    const speakerUrl = config.get<string>('DEFAULT_TTS_SPEAKER_URL');
    try {
      return ReplicateXttsAdapter.createWithFallback(speakerUrl);
    } catch {
      return null;
    }
  },
};

@Injectable()
export class TtsProviderRegistry {
  private readonly providers = new Map<TtsProviderId, ITtsProvider>();

  constructor(private configService: ConfigService) {
    this.registerAvailableProviders();
  }

  private registerAvailableProviders(): void {
    for (const id of TTS_PROVIDER_IDS) {
      try {
        const factory = PROVIDER_FACTORIES[id];
        if (factory) {
          const adapter = factory(this.configService);
          if (adapter) {
            this.providers.set(id, adapter);
          }
        }
      } catch {
        // Skip providers that fail to initialize
      }
    }
  }

  get(providerId: string): ITtsProvider | undefined {
    return this.providers.get(providerId as TtsProviderId);
  }

  getAvailableIds(): TtsProviderId[] {
    return Array.from(this.providers.keys());
  }

  getDefaultProviderId(): TtsProviderId {
    return TtsProviderId.Huggingface;
  }

  getProviderFallbackOrder(): TtsProviderId[] {
    return FALLBACK_ORDER.filter((id) => this.providers.has(id));
  }
}
