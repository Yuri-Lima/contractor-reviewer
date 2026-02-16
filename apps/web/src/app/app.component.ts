import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { ChecklistComponent } from './onboarding/checklist/checklist.component';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { OnboardingService } from './onboarding/onboarding.service';
import { RouteGuideService } from './onboarding/tour/route-guide.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent, ChecklistComponent],
  template: `
    <div class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      @if (showHeader()) {
        <app-header></app-header>
      }
      @if (showSidebar()) {
        <div class="flex flex-1">
          <app-sidebar [workspaceId]="currentWorkspaceId() || undefined"></app-sidebar>
          <main class="flex-1 bg-gray-50 dark:bg-gray-900 min-h-[calc(100vh-64px)] transition-colors duration-200">
            <router-outlet></router-outlet>
          </main>
        </div>
      } @else {
        <main class="flex-1 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          <router-outlet></router-outlet>
        </main>
      }
      @if (showChecklist()) {
        <app-onboarding-checklist></app-onboarding-checklist>
      }
    </div>
  `,
})
export class AppComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private onboardingService = inject(OnboardingService);
  private routeGuideService = inject(RouteGuideService);

  currentWorkspaceId = signal<string | null>(null);
  currentUrl = signal<string>(this.router.url);

  // Header should only show when authenticated AND not on auth routes
  showHeader = computed(() => 
    this.authService.isAuthenticated() && !this.isAuthRoute(this.currentUrl())
  );
  // Sidebar should only show when authenticated AND not on auth routes
  showSidebar = computed(() => 
    this.authService.isAuthenticated() && !this.isAuthRoute(this.currentUrl())
  );

  showChecklist = computed(() => {
    const state = this.onboardingService.state();
    const visible = this.onboardingService.isChecklistVisible();
    return (
      this.authService.isAuthenticated() &&
      !this.isAuthRoute(this.currentUrl()) &&
      state != null &&
      !state.completed &&
      !state.dismissed &&
      visible
    );
  });

  constructor() {
    this.routeGuideService.init();
    // Atualizar currentWorkspaceId quando a rota mudar
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        const match = event.urlAfterRedirects.match(/\/workspaces\/([^\/]+)/);
        this.currentWorkspaceId.set(match ? match[1] : null);
      });
  }

  private isAuthRoute(url: string): boolean {
    return url === '/login' || url === '/register' || url.startsWith('/login') || url.startsWith('/register');
  }
}
