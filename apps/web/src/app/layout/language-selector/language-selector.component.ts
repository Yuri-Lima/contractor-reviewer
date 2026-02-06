import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TranslateService } from '@ngx-translate/core';

export type Language = 'de' | 'en' | 'es' | 'pt-BR';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  template: `
    <p-select
      [options]="languageOptions()"
      [(ngModel)]="selectedLanguage"
      (ngModelChange)="onLanguageChange($event)"
      optionLabel="name"
      optionValue="code"
      [showClear]="false"
      [style]="{ width: '150px' }"
    >
      <ng-template let-language pTemplate="item">
        <div class="flex items-center gap-2">
          <span>{{ language.flag }}</span>
          <span>{{ language.name }}</span>
        </div>
      </ng-template>
      <ng-template let-language pTemplate="selectedItem">
        <div class="flex items-center gap-2">
          <span>{{ language.flag }}</span>
          <span class="hidden sm:inline">{{ language.name }}</span>
        </div>
      </ng-template>
    </p-select>
  `,
})
export class LanguageSelectorComponent {
  private translateService = inject(TranslateService);

  readonly availableLanguages = [
    { code: 'de' as Language, locale: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en' as Language, locale: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es' as Language, locale: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'pt-BR' as Language, locale: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷' },
  ];

  languageOptions = computed(() => this.availableLanguages);

  selectedLanguage: Language = (this.translateService.currentLang || 'en') as Language;

  constructor() {
    // Atualizar selectedLanguage quando currentLanguage mudar
    effect(() => {
      const lang = (this.translateService.currentLang || 'en') as Language;
      this.selectedLanguage = lang;
    });
  }

  onLanguageChange(lang: Language): void {
    if (lang && lang !== this.translateService.currentLang) {
      this.translateService.use(lang);
      localStorage.setItem('preferredLanguage', lang);
    }
  }
}
