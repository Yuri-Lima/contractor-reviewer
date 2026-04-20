type SupportedLocaleCode = 'en' | 'es' | 'pt-BR' | 'pt' | 'de';

const I18N_TO_ML_LANG: Record<SupportedLocaleCode, string> = {
  en: 'en',
  es: 'es',
  'pt-BR': 'pt',
  pt: 'pt',
  de: 'de',
};

const LANGUAGE_DISPLAY_NAMES: Record<SupportedLocaleCode, string> = {
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
