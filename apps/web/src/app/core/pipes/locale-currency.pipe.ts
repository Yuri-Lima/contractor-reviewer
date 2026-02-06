import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatCurrency } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

// Map language codes to locale codes
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  'de': 'de-DE',
  'en': 'en-US',
  'es': 'es-ES',
  'pt-BR': 'pt-BR'
};

@Pipe({
  name: 'localeCurrency',
  standalone: true,
  pure: false, // Não é pure para reagir a mudanças de locale
})
export class LocaleCurrencyPipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(
    value: number | null | undefined,
    currencyCode: string = 'USD',
    display?: 'code' | 'symbol' | 'symbol-narrow' | string,
    digitsInfo?: string
  ): string {
    if (value == null || isNaN(value)) {
      return '';
    }

    // Access currentLang to create reactive dependency
    const lang = this.translateService.currentLang || 'en';
    const locale = LANGUAGE_LOCALE_MAP[lang] || 'en-US';

    try {
      return formatCurrency(value, locale, currencyCode, currencyCode, digitsInfo);
    } catch (error) {
      console.error('Error formatting currency:', error);
      return String(value);
    }
  }
}
