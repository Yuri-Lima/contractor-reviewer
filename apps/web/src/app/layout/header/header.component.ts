import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Button } from 'primeng/button';
import { Avatar } from 'primeng/avatar';
import { AuthService } from '../../core/services/auth.service';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, Button, Avatar, ThemeSelectorComponent, LanguageSelectorComponent, TranslatePipe],
  template: `
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50 transition-colors duration-200">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center gap-4">
        <!-- Logo Section -->
        <a 
          routerLink="/workspaces" 
          class="flex items-center gap-2 sm:gap-3 text-gray-800 dark:text-gray-100 font-semibold text-lg sm:text-xl no-underline transition-colors hover:text-blue-600 dark:hover:text-blue-400 min-w-0 flex-shrink-0"
        >
          <i class="pi pi-file text-2xl sm:text-3xl text-blue-600 dark:text-blue-400 flex-shrink-0"></i>
          <span class="hidden md:inline truncate">ContractAI Review</span>
        </a>
        
        <!-- Right Section -->
        <div class="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0" *ngIf="isAuthenticated()">
          <!-- Language Selector -->
          <div class="hidden sm:block">
            <app-language-selector></app-language-selector>
          </div>
          
          <!-- Theme Selector -->
          <div class="hidden sm:block">
            <app-theme-selector></app-theme-selector>
          </div>
          
          <!-- User Info -->
          <div class="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg bg-gray-100 dark:bg-gray-700 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600">
            <p-avatar
              [label]="userInitials()"
              shape="circle"
              styleClass="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm flex-shrink-0"
            ></p-avatar>
            <span class="text-sm sm:text-base text-gray-700 dark:text-gray-200 hidden sm:inline font-medium transition-colors max-w-[120px] lg:max-w-[200px] truncate">
              {{ userName() }}
            </span>
          </div>
          
          <!-- Logout Button -->
          <p-button
            [label]="'common.logout' | translate"
            icon="pi pi-sign-out"
            severity="secondary"
            [outlined]="true"
            (onClick)="logout()"
            styleClass="text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 hidden sm:inline-flex"
          ></p-button>
          
          <!-- Mobile Logout Icon Button -->
          <p-button
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            (onClick)="logout()"
            styleClass="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 sm:hidden flex-shrink-0"
            [title]="'common.logout' | translate"
          ></p-button>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  private authService = inject(AuthService);

  isAuthenticated = computed(() => this.authService.isAuthenticated());
  currentUser = computed(() => this.authService.currentUser());
  
  userName = computed(() => {
    const user = this.currentUser();
    return user?.name || user?.email || '';
  });

  userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '?';
    const name = user.name || user.email;
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  });

  logout(): void {
    this.authService.logout();
  }
}
