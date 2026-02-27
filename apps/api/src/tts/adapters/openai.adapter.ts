import OpenAI from 'openai';
import type { ITtsProvider, TtsSynthesizeOptions } from '../interfaces/tts-provider.interface';
import { TtsProviderId } from '@contractai-review/shared';

const DEFAULT_VOICE = 'coral';
const MODEL = 'gpt-4o-mini-tts';

export class OpenAITtsAdapter implements ITtsProvider {
  readonly id: TtsProviderId = TtsProviderId.OpenAI;

  private resolveApiKey(options?: TtsSynthesizeOptions): string {
    const key = options?.apiKey?.trim();
    if (key) return key;
    throw new Error(
      'OpenAI TTS requires an API key. Add your key in Workspace Settings → Voice.',
    );
  }

  async synthesize(
    text: string,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer> {
    const apiKey = this.resolveApiKey(options);
    const client = new OpenAI({ apiKey });
    const voice = options?.voice || DEFAULT_VOICE;

    const response = await client.audio.speech.create({
      model: MODEL,
      voice: voice as 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar',
      input: text,
      response_format: 'wav',
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
