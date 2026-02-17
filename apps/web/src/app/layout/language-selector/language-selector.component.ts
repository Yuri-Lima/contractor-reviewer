import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Language, LanguageConfig } from '../../core/services/i18n.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TooltipModule, TranslatePipe],
  templateUrl: './language-selector.html',
})
export class LanguageSelectorComponent {
  private translateService = inject(TranslateService);

  readonly availableLanguages: readonly LanguageConfig[] = [
    { code: 'de', locale: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', locale: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es', locale: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'pt-BR', locale: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷' },
  ];

  languageOptions = computed(() => [...this.availableLanguages]);

  selectedLanguage: Language = this.getValidLanguage(this.translateService.getCurrentLang() ?? 'en');

  constructor() {
    // Atualizar selectedLanguage quando currentLanguage mudar
    effect(() => {
      const lang = this.getValidLanguage(this.translateService.getCurrentLang() ?? 'en');
      this.selectedLanguage = lang;
    });
  }

  private isValidLanguage(lang: string | null | undefined): lang is Language {
    return lang !== null && lang !== undefined && ['de', 'en', 'es', 'pt-BR'].includes(lang);
  }

  private getValidLanguage(lang: string | null | undefined): Language {
    return this.isValidLanguage(lang) ? lang : 'en';
  }

  onLanguageChange(lang: Language): void {
    if (lang && lang !== this.translateService.currentLang) {
      this.translateService.use(lang);
      localStorage.setItem('preferredLanguage', lang);
    }
  }
}
