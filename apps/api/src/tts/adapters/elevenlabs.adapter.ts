import { mapI18nToMlLang, TtsProviderId } from '@contractai-review/shared';
import type { ITtsProvider, TtsSynthesizeOptions } from '../interfaces/tts-provider.interface';

const BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel - premade voice
const MODEL = 'eleven_turbo_v2_5';
const FORMAT_MP3 = 'mp3_44100_128'; // free/starter tier
const FORMAT_WAV = 'wav_44100'; // Pro+ tier

const PRO_TIERS = ['pro', 'scale', 'business'] as const;

export class ElevenLabsTtsAdapter implements ITtsProvider {
  readonly id: TtsProviderId = TtsProviderId.ElevenLabs;

  private resolveApiKey(options?: TtsSynthesizeOptions): string {
    const key = options?.apiKey?.trim();
    if (key) return key;
    throw new Error(
      'ElevenLabs TTS requires an API key. Add your key in Workspace Settings → Voice.',
    );
  }

  private resolveOutputFormat(options?: TtsSynthesizeOptions): string {
    const cfg = options?.providerConfig;
    if (cfg?.outputFormat?.trim()) return cfg.outputFormat.trim();
    const plan = cfg?.plan?.toLowerCase();
    if (plan && PRO_TIERS.includes(plan as (typeof PRO_TIERS)[number])) {
      return FORMAT_WAV;
    }
    return FORMAT_MP3;
  }

  async synthesize(
    text: string,
    options?: TtsSynthesizeOptions,
  ): Promise<Buffer> {
    const apiKey = this.resolveApiKey(options);
    const voiceId = options?.voice?.trim() || DEFAULT_VOICE;
    const languageCode = options?.language ? mapI18nToMlLang(options.language) : undefined;
    const outputFormat = this.resolveOutputFormat(options);

    const url = `${BASE_URL}/${voiceId}?output_format=${outputFormat}`;
    const body: Record<string, unknown> = {
      text,
      model_id: MODEL,
    };
    if (languageCode) {
      body.language_code = languageCode;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `ElevenLabs TTS failed: ${response.status} ${response.statusText}. ${errText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
