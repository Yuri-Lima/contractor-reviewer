import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ITranscriptionProvider, TranscriptionResult } from '../interfaces/transcription-provider.interface';

@Injectable()
export class OpenAITranscriptionProvider implements ITranscriptionProvider {
  readonly id = 'openai';
  private readonly model = 'whisper-1';

  constructor(private configService: ConfigService) {}

  private resolveApiKey(options?: { apiKey?: string }): string {
    const fromOptions = options?.apiKey?.trim();
    if (fromOptions) return fromOptions;
    throw new Error(
      'OpenAI provider requires an API key. Add your key in Workspace Settings → Voice.',
    );
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string; apiKey?: string; signal?: AbortSignal },
  ): Promise<TranscriptionResult> {
    const apiKey = this.resolveApiKey(options);
    const client = new OpenAI({ apiKey });
    const ext = this.getExtension(mimeType);
    const file = new File([new Uint8Array(audioBuffer)], `audio.${ext}`, {
      type: mimeType,
    });

    const transcription = await client.audio.transcriptions.create(
      {
        file,
        model: this.model,
        language: options?.language?.split('-')[0] ?? undefined,
      },
      options?.signal ? { signal: options.signal } : undefined,
    );

    return {
      text: transcription.text?.trim() ?? '',
      provider: this.id,
    };
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
    };
    return map[mimeType] ?? 'webm';
  }
}
