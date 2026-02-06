import { bootstrapApplication } from '@angular/platform-browser';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeEs from '@angular/common/locales/es';
import localePt from '@angular/common/locales/pt';
import { providePrimeNG, PrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

// Registrar todos os locales do Angular
registerLocaleData(localeDe, 'de-DE');
registerLocaleData(localeEn, 'en-US');
registerLocaleData(localeEs, 'es-ES');
registerLocaleData(localePt, 'pt-BR');



// Map language codes to locale codes for LOCALE_ID
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  'de': 'de-DE',
  'en': 'en-US',
  'es': 'es-ES',
  'pt-BR': 'pt-BR'
};

// Provider factory para LOCALE_ID dinâmico
export function localeIdFactory(): string {
  const saved = localStorage.getItem('preferredLanguage');
  const lang = saved && LANGUAGE_LOCALE_MAP[saved] ? saved : 'en';
  return LANGUAGE_LOCALE_MAP[lang] || 'en-US';
}

// Detect default language
function getDefaultLanguage(): string {
  const saved = localStorage.getItem('preferredLanguage');
  if (saved && ['de', 'en', 'es', 'pt-BR'].includes(saved)) {
    return saved;
  }
  const browserLang = navigator.language || (navigator as any).userLanguage;
  if (browserLang.startsWith('de')) return 'de';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('pt')) return 'pt-BR';
  return 'en';
}

// Traduções básicas do PrimeNG (serão atualizadas dinamicamente pelo TranslateService)
const primengTranslations = {
  accept: 'Accept',
  reject: 'Reject',
  choose: 'Choose',
  upload: 'Upload',
  cancel: 'Cancel',
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  dayNamesMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  today: 'Today',
  clear: 'Clear',
  dateFormat: 'mm/dd/yy',
  firstDayOfWeek: 0,
};

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideTranslateService({
      fallbackLang: 'en',
    }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
      // Note: If translations fail to load (404), try:
      // 1. Restart the dev server
      // 2. Clear Angular cache: rm -rf .angular/cache
      // 3. Verify files exist at: apps/web/src/assets/i18n/*.json
    }),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
          cssLayer: false
        }
      },
      translation: primengTranslations // Tradução inicial (será atualizada dinamicamente)
    }),
    {
      provide: LOCALE_ID,
      useFactory: localeIdFactory
    },
  ],
}).then(appRef => {
  // Initialize TranslateService and update PrimeNG translations
  const translateService = appRef.injector.get(TranslateService);
  const primeng = appRef.injector.get(PrimeNG);
  
  // Set initial language
  const defaultLang = getDefaultLanguage();
  translateService.setFallbackLang('en');
  
  // Subscribe to language changes to update PrimeNG (this provides translations in the event)
  translateService.onLangChange.subscribe((event: any) => {
    updatePrimeNGTranslations(event.lang, primeng, event.translations);
  });
  
  // Load translations and then update PrimeNG
  translateService.use(defaultLang).subscribe({
    next: () => {
      // Translations will be updated via onLangChange subscription
    },
    error: (err) => {
      console.error('Error loading translations for', defaultLang, ':', err);
      // Try to load fallback (English) if current language fails
      if (defaultLang !== 'en') {
        console.log('Attempting to load fallback language (en)...');
        translateService.use('en').subscribe({
          next: () => {
            console.log('Fallback translations (en) loaded successfully');
          },
          error: (fallbackErr) => {
            console.error('Failed to load fallback translations:', fallbackErr);
          }
        });
      }
    }
  });
}).catch((err) => console.error(err));

// PrimeNG translations mapping - loads from JSON files
function updatePrimeNGTranslations(lang: string, primeng: PrimeNG, translations: any): void {
  // Get primeNg translations from the loaded JSON file
  const primeNgTranslations = translations?.['primeNg'];
  primeng.setTranslation(primeNgTranslations);
}
