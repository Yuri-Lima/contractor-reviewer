import Replicate from 'replicate';
import { mapI18nToMlLang, TtsProviderId } from '@contractai-review/shared';
import type { ITtsProvider, TtsSynthesizeOptions } from '../interfaces/tts-provider.interface';

const MODEL = 'lucataco/xtts-v2';

/** Public 6s+ neutral English sample from LJ Speech (fallback when env not set) */
const FALLBACK_SPEAKER_URL =
  'https://huggingface.co/datasets/Edresson/LJ-Speech/resolve/main/wavs/LJ001-0001.wav';

export class ReplicateXttsAdapter implements ITtsProvider {
  readonly id: TtsProviderId = TtsProviderId.ReplicateXtts;

  constructor(private readonly defaultSpeakerUrl: string) {
    if (!this.defaultSpeakerUrl?.trim()) {
      throw new Error(
        'Replicate XTTS requires DEFAULT_TTS_SPEAKER_URL (6+ second WAV). Set it in .env.',
      );
    }
  }

  static createWithFallback(envUrl?: string): ReplicateXttsAdapter {
    const url = envUrl?.trim() || FALLBACK_SPEAKER_URL;
    return new ReplicateXttsAdapter(url);
  }

  private resolveApiKey(options?: TtsSynthesizeOptions): string {
    const key = options?.apiKey?.trim();
    if (key) return key;
    throw new Error(
      'Replicate TTS requires an API key. Add your key in Workspace Settings → Voice.',
    );
  }

  async synthesize(
    text: string,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer> {
    const apiKey = this.resolveApiKey(options);
    const replicate = new Replicate({ auth: apiKey });

    const lang = options?.language ? mapI18nToMlLang(options.language) : 'en';

    const output = await replicate.run(MODEL as `${string}/${string}`, {
      input: {
        text,
        speaker: this.defaultSpeakerUrl,
        language: lang,
      },
    });

    if (typeof output !== 'string') {
      throw new Error('Replicate XTTS returned unexpected output format');
    }

    const audioResponse = await fetch(output);
    if (!audioResponse.ok) {
      throw new Error(
        `Failed to fetch Replicate audio: ${audioResponse.status} ${audioResponse.statusText}`,
      );
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
