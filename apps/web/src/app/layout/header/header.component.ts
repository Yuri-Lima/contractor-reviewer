import { Component, computed, inject, viewChild, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Button } from 'primeng/button';
import { Avatar } from 'primeng/avatar';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, Button, Avatar, Menu, ThemeSelectorComponent, LanguageSelectorComponent, TranslatePipe],
  templateUrl: './header.html',
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private translateService = inject(TranslateService);

  menuRef = viewChild<Menu>('menu');
  
  isAuthenticated = computed(() => this.authService.isAuthenticated());
  currentUser = computed(() => this.authService.currentUser());
  
  menuItems = signal<MenuItem[]>([]);
  
  private langChangeSubscription?: Subscription;
  
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

  ngOnInit(): void {
    // Initialize menu items with translations
    this.updateMenuItems();
    
    // Update menu items when language changes
    this.langChangeSubscription = this.translateService.onLangChange.subscribe(() => {
      this.updateMenuItems();
    });
  }

  ngOnDestroy(): void {
    if (this.langChangeSubscription) {
      this.langChangeSubscription.unsubscribe();
    }
  }

  private updateMenuItems(): void {
    this.menuItems.set([
      {
        label: this.translateService.instant('settings.title'),
        icon: 'pi pi-cog',
        routerLink: '/settings',
      },
      {
        separator: true,
      },
      {
        label: this.translateService.instant('common.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout(),
      },
    ]);
  }

  toggleMenu(event: Event): void {
    this.menuRef()?.toggle(event);
  }

  logout(): void {
    this.authService.logout();
  }
}
