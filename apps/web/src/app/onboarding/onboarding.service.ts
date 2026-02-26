import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '../core/routes';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { OnboardingState } from '@contractai-review/shared';
import { CHECKLIST_KEYS } from '@contractai-review/shared';
import type { ChecklistKey, RouteGuideKey } from '@contractai-review/shared';

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  state = signal<OnboardingState | null>(null);
  /** True after the first loadState() request completes (success or error). */
  stateLoadAttempted = signal(false);

  progress = computed(() => {
    const s = this.state();
    if (!s?.checklist) return 0;
    const keys = CHECKLIST_KEYS;
    const completed = keys.filter((k: string) => s.checklist[k]).length;
    return keys.length > 0 ? Math.round((completed / keys.length) * 100) : 0;
  });
  isChecklistVisible = signal(false);

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadState();
      } else {
        this.state.set(null);
        this.isChecklistVisible.set(false);
      }
    });
    // Show checklist for new users or after reset when not completed/dismissed
    effect(() => {
      const s = this.state();
      if (s && !s.completed && !s.dismissed) {
        this.isChecklistVisible.set(true);
      }
    });
  }

  loadState(): void {
    if (!this.authService.isAuthenticated()) return;
    this.apiService.getOnboardingState().subscribe({
      next: (s) => {
        this.state.set(s);
        this.stateLoadAttempted.set(true);
      },
      error: () => {
        this.state.set(null);
        this.stateLoadAttempted.set(true);
      },
    });
  }

  updateChecklist(key: string, value: boolean): void {
    this.apiService.updateOnboardingChecklist({ key, value }).subscribe({
      next: (s) => this.state.set(s),
    });
  }

  updateVisitedRoute(key: string, value: boolean): void {
    this.apiService.updateVisitedRoute({ key, value }).subscribe({
      next: (s) => this.state.set(s),
    });
  }

  markRouteVisited(key: RouteGuideKey): void {
    this.updateVisitedRoute(key, true);
  }

  hasVisitedRoute(key: RouteGuideKey): boolean {
    return !!this.state()?.visitedRoutes?.[key];
  }

  updateTour(tourKey: string, updates: { dismissed?: boolean; completed?: boolean; lastStepId?: string }): void {
    this.apiService
      .updateOnboardingTour({ tourKey, ...updates })
      .subscribe({
        next: (s) => this.state.set(s),
      });
  }

  completeOnboarding(): void {
    this.apiService.completeOnboarding().subscribe({
      next: (s) => this.state.set(s),
    });
  }

  dismissOnboarding(): void {
    this.apiService.dismissOnboarding().subscribe({
      next: (s) => this.state.set(s),
    });
  }

  resetOnboarding(): void {
    this.apiService.resetOnboarding().subscribe({
      next: (s) => {
        this.state.set(s);
        this.isChecklistVisible.set(true);
        this.router.navigate([ROUTES.WORKSPACES]);
      },
    });
  }

  markChecklistItem(key: ChecklistKey): void {
    const keys = CHECKLIST_KEYS as readonly string[];
    if (!keys.includes(key)) return;
    this.updateChecklist(key, true);
  }

  showChecklist(): void {
    this.isChecklistVisible.set(true);
  }

  hideChecklist(): void {
    this.isChecklistVisible.set(false);
  }
}
