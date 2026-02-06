import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatNumber } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

// Map language codes to locale codes
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  'de': 'de-DE',
  'en': 'en-US',
  'es': 'es-ES',
  'pt-BR': 'pt-BR'
};

@Pipe({
  name: 'localeNumber',
  standalone: true,
  pure: false, // Não é pure para reagir a mudanças de locale
})
export class LocaleNumberPipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(value: number | null | undefined, digitsInfo?: string): string {
    if (value == null || isNaN(value)) {
      return '';
    }

    // Access currentLang to create reactive dependency
    const lang = this.translateService.currentLang || 'en';
    const locale = LANGUAGE_LOCALE_MAP[lang] || 'en-US';

    try {
      return formatNumber(value, locale, digitsInfo);
    } catch (error) {
      console.error('Error formatting number:', error);
      return String(value);
    }
  }
}
