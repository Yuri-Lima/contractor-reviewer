/**
 * Supported i18n locale codes. Single source of truth for app languages.
 */
export const SUPPORTED_LOCALE_CODES = ['en', 'es', 'pt-BR', 'pt', 'de'] as const;

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALE_CODES)[number];

/**
 * Maps app i18n locale codes to ML model language codes (Whisper, TTS).
 * Reused by transcription providers and TTS adapters.
 */
export const I18N_TO_ML_LANG: Record<SupportedLocaleCode, string> = {
  en: 'en',
  es: 'es',
  'pt-BR': 'pt',
  pt: 'pt',
  de: 'de',
};

/**
 * Display names for supported locale codes (used in prompts, UI).
 */
export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLocaleCode, string> = {
  en: 'English',
  es: 'Spanish',
  'pt-BR': 'Portuguese (Brazil)',
  pt: 'Portuguese',
  de: 'German',
};

/** Map i18n locale to model language. Falls back to first segment of locale (e.g. pt-BR -> pt) or 'en'. */
export function mapI18nToMlLang(i18nLang: string): string {
  const mapped = I18N_TO_ML_LANG[i18nLang as SupportedLocaleCode];
  return mapped ?? i18nLang.split('-')[0] ?? 'en';
}

/** Map language code to display name. Falls back to 'English' for unknown codes. */
export function getLanguageDisplayName(languageCode: string): string {
  const name = LANGUAGE_DISPLAY_NAMES[languageCode as SupportedLocaleCode];
  return name ?? 'English';
}
