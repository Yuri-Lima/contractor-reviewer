/**
 * Maps app i18n locale codes to ML model language codes (Whisper, TTS).
 * Reused by transcription providers and TTS adapters.
 */
export const I18N_TO_ML_LANG: Record<string, string> = {
  en: 'en',
  es: 'es',
  'pt-BR': 'pt',
  pt: 'pt',
  de: 'de',
};

/** Map i18n locale to model language. Falls back to first segment of locale (e.g. pt-BR -> pt) or 'en'. */
export function mapI18nToMlLang(i18nLang: string): string {
  return I18N_TO_ML_LANG[i18nLang] ?? i18nLang.split('-')[0] ?? 'en';
}
