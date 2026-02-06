import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 transition-colors">
      <!-- Sun Icon (Day/Light) -->
      <i 
        class="pi pi-sun text-base transition-all duration-200"
        [class.text-yellow-500]="!isDarkMode()"
        [class.text-gray-400]="isDarkMode()"
        [class.scale-110]="!isDarkMode()"
        title="Dia - Modo Claro"
      ></i>
      
      <button
        type="button"
        (click)="toggleDarkMode($event)"
        class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
        [class.bg-blue-500]="isDarkMode()"
        [class.bg-yellow-400]="!isDarkMode()"
        title="{{ isDarkMode() ? 'Alternar para Modo Claro (Dia)' : 'Alternar para Modo Escuro (Noite)' }}"
      >
        <span
          class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
          [class.translate-x-5]="isDarkMode()"
          [class.translate-x-0.5]="!isDarkMode()"
        ></span>
      </button>
      
      <!-- Moon Icon (Night/Dark) -->
      <i 
        class="pi pi-moon text-base transition-all duration-200"
        [class.text-blue-300]="isDarkMode()"
        [class.text-gray-400]="!isDarkMode()"
        [class.scale-110]="isDarkMode()"
        title="Noite - Modo Escuro"
      ></i>
    </div>
  `,
})
export class ThemeSelectorComponent {
  private themeService = inject(ThemeService);

  isDarkMode = computed(() => this.themeService.isDarkMode());

  toggleDarkMode(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Read current theme and dark mode state
    const currentTheme = this.themeService.theme();
    const currentlyDark = this.isDarkMode();
    
    let targetTheme: 'light' | 'dark';
    
    if (currentTheme === 'auto') {
      // If auto, switch to explicit dark/light based on current visual state
      targetTheme = currentlyDark ? 'light' : 'dark';
    } else {
      // Toggle between light and dark
      targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    }
    
    // Update theme - signals will automatically trigger change detection
    this.themeService.setTheme(targetTheme);
  }
}
