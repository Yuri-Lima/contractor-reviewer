import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import type { ITranscriptionProvider, TranscriptionResult } from '../interfaces/transcription-provider.interface';

const I18N_TO_WHISPER_LANG: Record<string, string> = {
  en: 'en',
  es: 'es',
  'pt-BR': 'pt',
  pt: 'pt',
  de: 'de',
};

@Injectable()
export class HuggingFaceTranscriptionProvider implements ITranscriptionProvider {
  readonly id = 'huggingface';
  private readonly model = 'openai/whisper-large-v3';

  constructor(private configService: ConfigService) {}

  private resolveToken(options?: { apiKey?: string }): string {
    const fromOptions = options?.apiKey?.trim();
    if (fromOptions) return fromOptions;
    throw new Error(
      'HuggingFace provider requires an API key. Add your key in Workspace Settings → Voice.',
    );
  }

  /** Maps MIME types to those supported by HuggingFace ASR (audio/mp4 -> audio/m4a). */
  private normalizeMimeType(mimeType: string): string {
    const base = mimeType.split(';')[0].trim().toLowerCase();
    if (base === 'audio/mp4') return 'audio/m4a';
    return base;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string; apiKey?: string },
  ): Promise<TranscriptionResult> {
    const token = this.resolveToken(options);
    const client = new InferenceClient(token);
    const lang = options?.language ? this.mapLanguage(options.language) : undefined;
    const normalizedMime = this.normalizeMimeType(mimeType);
    const data = new Blob([new Uint8Array(audioBuffer)], { type: normalizedMime });

    const provider = this.configService.get<string>('HF_INFERENCE_PROVIDER', 'hf-inference');
    const result = await client.automaticSpeechRecognition({
      model: this.model,
      data,
      provider,
      parameters: lang ? { language: lang } : undefined,
      // Cast needed: package unions AutomaticSpeechRecognitionInput | LegacyAudioInput; we use data (LegacyAudioInput)
    } as Parameters<typeof client.automaticSpeechRecognition>[0]);

    if (typeof result === 'object' && result !== null && 'text' in result) {
      const text = (result as { text?: string }).text ?? '';
      return { text: text.trim(), provider: this.id };
    }
    const text = typeof result === 'string' ? result : '';
    return { text: text.trim(), provider: this.id };
  }

  private mapLanguage(i18nLang: string): string {
    return I18N_TO_WHISPER_LANG[i18nLang] ?? i18nLang.split('-')[0] ?? 'en';
  }
}
