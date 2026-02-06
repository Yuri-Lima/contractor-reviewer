import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

// Map language codes to locale codes
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  'de': 'de-DE',
  'en': 'en-US',
  'es': 'es-ES',
  'pt-BR': 'pt-BR'
};

@Pipe({
  name: 'localeDate',
  standalone: true,
  pure: false, // Não é pure para reagir a mudanças de locale
})
export class LocaleDatePipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(value: Date | string | number | null | undefined, format?: string, timezone?: string): string {
    if (value == null) {
      return '';
    }

    // Access currentLang to create reactive dependency
    const lang = this.translateService.currentLang || 'en';
    const locale = LANGUAGE_LOCALE_MAP[lang] || 'en-US';
    const dateValue = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;

    if (isNaN(dateValue.getTime())) {
      return '';
    }

    try {
      return formatDate(dateValue, format || 'short', locale, timezone);
    } catch (error) {
      console.error('Error formatting date:', error);
      return String(value);
    }
  }
}
