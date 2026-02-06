import { Injectable, signal, computed, effect, inject, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { PrimeNG } from 'primeng/config';
import { catchError, map, of, switchMap } from 'rxjs';

export type Language = 'de' | 'en' | 'es' | 'pt-BR';

export interface LanguageConfig {
  code: Language;
  locale: string; // Locale code para formatação (ex: 'de-DE', 'en-US', 'es-ES', 'pt-BR')
  name: string; // Nome nativo do idioma
  flag?: string; // Código da bandeira (opcional)
}

export interface TranslationFile {
  [key: string]: string | TranslationFile;
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private http = inject(HttpClient);
  private primeng = inject(PrimeNG);

  // Mapeamento de Language para locale codes
  private readonly LANGUAGE_LOCALE_MAP: Record<Language, string> = {
    'de': 'de-DE',
    'en': 'en-US',
    'es': 'es-ES',
    'pt-BR': 'pt-BR'
  };

  // Cache de traduções carregadas
  private translationsCache = new Map<Language, TranslationFile>();

  // Set para rastrear chaves ausentes (apenas em dev mode)
  private missingKeys = new Set<string>();

  // Signal para idioma atual
  private _currentLanguage = signal<Language>(this.detectLanguage());
  currentLanguage = this._currentLanguage.asReadonly();

  // Signal para locale atual
  currentLocale = computed(() => this.LANGUAGE_LOCALE_MAP[this._currentLanguage()]);

  // Signal para traduções carregadas
  translations = signal<TranslationFile>({});

  // Signal para estado de carregamento
  isLoading = signal<boolean>(false);

  // Configurações de idiomas disponíveis
  readonly availableLanguages: LanguageConfig[] = [
    { code: 'de', locale: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', locale: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es', locale: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'pt-BR', locale: 'pt-BR', name: 'Português (BR)', flag: '🇧🇷' },
  ];

  constructor() {
    // Carregar traduções iniciais
    this.loadTranslations(this._currentLanguage());

    // Effect para salvar preferência quando idioma mudar
    effect(() => {
      const lang = this._currentLanguage();
      localStorage.setItem('preferredLanguage', lang);
    });
  }

  /**
   * Detecta o idioma do navegador ou retorna o idioma salvo no localStorage
   */
  private detectLanguage(): Language {
    // Verificar se há preferência salva
    const saved = localStorage.getItem('preferredLanguage') as Language | null;
    if (saved && this.isValidLanguage(saved)) {
      return saved;
    }

    // Detectar idioma do navegador
    const browserLang = navigator.language || (navigator as any).userLanguage;
    
    if (browserLang.startsWith('de')) return 'de';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('pt')) return 'pt-BR';
    
    // Padrão: inglês
    return 'en';
  }

  /**
   * Verifica se um idioma é válido
   */
  private isValidLanguage(lang: string): lang is Language {
    return ['de', 'en', 'es', 'pt-BR'].includes(lang);
  }

  /**
   * Carrega traduções do arquivo JSON
   */
  private loadTranslations(lang: Language): void {
    // Verificar cache primeiro
    const cached = this.translationsCache.get(lang);
    if (cached) {
      // Atualização síncrona quando há cache
      this.translations.set(cached);
      this.updatePrimeNGTranslation(lang);
      return;
    }

    // Carregamento assíncrono
    this.isLoading.set(true);
    this.http
      .get<TranslationFile>(`/assets/i18n/${lang}.json`)
      .pipe(
        catchError((error) => {
          console.error(`Failed to load translations for ${lang}:`, error);
          // Fallback para inglês se falhar
          if (lang !== 'en') {
            return this.http.get<TranslationFile>('/assets/i18n/en.json');
          }
          return of({});
        })
      )
      .subscribe({
        next: (translations) => {
          this.translationsCache.set(lang, translations);
          this.translations.set(translations);
          this.updatePrimeNGTranslation(lang);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Define o idioma atual
   */
  setLanguage(lang: Language): void {
    if (!this.isValidLanguage(lang)) {
      console.warn(`Invalid language: ${lang}`);
      return;
    }

    this._currentLanguage.set(lang);
    this.loadTranslations(lang);
  }

  /**
   * Obtém o locale code atual
   */
  getLocale(): string {
    return this.currentLocale();
  }

  /**
   * Traduz uma chave (suporta chaves aninhadas como 'common.login')
   */
  translate(key: string, params?: Record<string, string | number>): string {
    if (!key || typeof key !== 'string') {
      if (isDevMode()) {
        console.warn('I18nService.translate: Invalid key provided', key);
      }
      return key || '';
    }

    const translations = this.translations();
    
    // Se as traduções ainda não foram carregadas (objeto vazio), retornar a chave sem warning
    if (!translations || Object.keys(translations).length === 0) {
      return key;
    }
    
    const value = this.getNestedValue(translations, key);

    if (typeof value !== 'string') {
      // Só mostrar warning em dev mode e apenas uma vez por chave
      if (isDevMode() && !this.missingKeys.has(key)) {
        this.missingKeys.add(key);
        console.warn(`[I18nService] Translation not found for key: "${key}" (Language: ${this._currentLanguage()})`);
      }
      return key; // Fallback para a chave
    }

    // Substituir parâmetros se fornecidos
    if (params) {
      try {
        return this.replaceParams(value, params);
      } catch (error) {
        if (isDevMode()) {
          console.error(`[I18nService] Error replacing params for key "${key}":`, error);
        }
        return value; // Retornar valor sem parâmetros em caso de erro
      }
    }

    return value;
  }

  /**
   * Obtém valor aninhado de um objeto usando notação de ponto
   * Melhorado para lidar com casos extremos e tipos inválidos
   */
  private getNestedValue(obj: any, path: string): string | undefined {
    if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
      return undefined;
    }

    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (key === '') {
        // Chave vazia, pular
        continue;
      }

      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current !== 'object') {
        // Tentando acessar propriedade de um valor primitivo
        return undefined;
      }

      current = current[key];

      // Se chegamos ao final e temos um valor string, retornar
      if (keys.indexOf(key) === keys.length - 1) {
        return typeof current === 'string' ? current : undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Substitui parâmetros em uma string (ex: "Hello {{name}}" com {name: "John"} -> "Hello John")
   * Melhorado para validar entrada e lidar com casos extremos
   */
  private replaceParams(text: string, params: Record<string, string | number>): string {
    if (!text || typeof text !== 'string') {
      return text || '';
    }

    if (!params || typeof params !== 'object') {
      return text;
    }

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        return String(params[key]);
      }
      // Em dev mode, avisar sobre parâmetros faltando
      if (isDevMode()) {
        console.warn(`[I18nService] Parameter "${key}" not provided for translation: "${text.substring(0, 50)}..."`);
      }
      return match; // Manter o placeholder se o parâmetro não existir
    });
  }

  /**
   * Traduções do PrimeNG por idioma
   */
  private readonly PRIMENG_TRANSLATIONS: Record<Language, any> = {
    'de': {
      accept: 'Akzeptieren',
      reject: 'Ablehnen',
      choose: 'Wählen',
      upload: 'Hochladen',
      cancel: 'Abbrechen',
      dayNames: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
      dayNamesShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
      dayNamesMin: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
      monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
      monthNamesShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      today: 'Heute',
      clear: 'Löschen',
      dateFormat: 'dd.mm.yy',
      firstDayOfWeek: 1,
    },
    'en': {
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
    },
    'es': {
      accept: 'Aceptar',
      reject: 'Rechazar',
      choose: 'Elegir',
      upload: 'Subir',
      cancel: 'Cancelar',
      dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      dayNamesMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
      monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      today: 'Hoy',
      clear: 'Limpiar',
      dateFormat: 'dd/mm/yy',
      firstDayOfWeek: 1,
    },
    'pt-BR': {
      accept: 'Aceitar',
      reject: 'Rejeitar',
      choose: 'Escolher',
      upload: 'Enviar',
      cancel: 'Cancelar',
      dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
      dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      dayNamesMin: ['Do', 'Se', 'Te', 'Qu', 'Qu', 'Se', 'Sá'],
      monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
      monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      today: 'Hoje',
      clear: 'Limpar',
      dateFormat: 'dd/mm/yy',
      firstDayOfWeek: 0,
    },
  };

  /**
   * Atualiza traduções do PrimeNG quando idioma mudar
   */
  private updatePrimeNGTranslation(lang: Language): void {
    const translation = this.PRIMENG_TRANSLATIONS[lang];
    if (translation) {
      this.primeng.setTranslation(translation);
    }
  }
}
