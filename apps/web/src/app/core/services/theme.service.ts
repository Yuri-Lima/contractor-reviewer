import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly THEME_KEY = 'contractai-theme';

  // Signal para o tema atual
  theme = signal<Theme>(this.getInitialTheme());

  // Signal para saber se está em dark mode
  isDarkMode = signal<boolean>(false);

  // Media query para detectar preferência do sistema
  private darkModeQuery?: MediaQueryList;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Detectar preferência do sistema
      this.darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Listener para mudanças na preferência do sistema
      this.darkModeQuery.addEventListener('change', () => {
        if (this.theme() === 'auto') {
          this.updateDarkMode();
        }
      });

      // Effect para aplicar o tema quando mudar
      effect(() => {
        const currentTheme = this.theme();
        if (isPlatformBrowser(this.platformId)) {
          this.saveTheme(currentTheme);
          this.updateDarkMode();
          // Apply theme synchronously - signals handle change detection
          this.applyTheme();
        }
      });

      // Aplicar tema inicial
      if (isPlatformBrowser(this.platformId)) {
        this.updateDarkMode();
        this.applyTheme();
      }
    }
  }

  private getInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light';
    }

    const saved = localStorage.getItem(this.THEME_KEY);
    if (saved && (saved === 'light' || saved === 'dark' || saved === 'auto')) {
      return saved as Theme;
    }

    return 'auto';
  }

  private updateDarkMode(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const currentTheme = this.theme();
    let shouldBeDark = false;

    if (currentTheme === 'dark') {
      shouldBeDark = true;
    } else if (currentTheme === 'light') {
      shouldBeDark = false;
    } else {
      // auto - usar preferência do sistema
      shouldBeDark = this.darkModeQuery?.matches ?? false;
    }

    // Always update to ensure signal change detection triggers
    this.isDarkMode.set(shouldBeDark);
  }

  private applyTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const isDark = this.isDarkMode();
    const html = document.documentElement;

    // Apply theme synchronously - ensure DOM is updated immediately
    // Force remove dark class first, then add if needed
    html.classList.remove('dark');
    
    if (isDark) {
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
    } else {
      html.setAttribute('data-theme', 'light');
    }
    
    // Force a reflow to ensure styles are applied immediately
    void html.offsetHeight;
  }

  private saveTheme(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.THEME_KEY, theme);
  }

  setTheme(theme: Theme): void {
    if (this.theme() !== theme) {
      this.theme.set(theme);
      // Force immediate update - effect may not trigger synchronously
      if (isPlatformBrowser(this.platformId)) {
        this.updateDarkMode();
        this.applyTheme();
      }
    }
  }

  toggleTheme(): void {
    const current = this.theme();
    if (current === 'light') {
      this.setTheme('dark');
    } else if (current === 'dark') {
      this.setTheme('auto');
    } else {
      this.setTheme('light');
    }
  }
}
