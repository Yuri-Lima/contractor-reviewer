import type { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import { mapI18nToMlLang, TtsProviderId } from '@contractai-review/shared';
import type { ITtsProvider, TtsSynthesizeOptions } from '../interfaces/tts-provider.interface';

/** Kokoro-82M via Fal.ai - suno/bark is not deployed by any Inference Provider. */
const MODEL = 'hexgrad/Kokoro-82M';

export class HuggingFaceTtsAdapter implements ITtsProvider {
  readonly id: TtsProviderId = TtsProviderId.Huggingface;

  constructor(private readonly configService?: ConfigService) {}

  private resolveToken(options?: TtsSynthesizeOptions): string {
    const token = options?.apiKey?.trim();
    if (token) return token;
    throw new Error(
      'Hugging Face TTS requires an API key. Add your key in Workspace Settings → Voice.',
    );
  }

  private getProvider(): string {
    return this.configService?.get<string>('HF_TTS_PROVIDER', 'fal-ai') ?? 'fal-ai';
  }

  async synthesize(
    text: string,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer> {
    const token = this.resolveToken(options);
    const client = new InferenceClient(token);
    const lang = options?.language ? mapI18nToMlLang(options.language) : undefined;

    const blob = await client.textToSpeech({
      model: MODEL,
      inputs: text,
      provider: this.getProvider(),
      parameters: lang ? { language: lang } : undefined,
    } as Parameters<typeof client.textToSpeech>[0]);

    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
