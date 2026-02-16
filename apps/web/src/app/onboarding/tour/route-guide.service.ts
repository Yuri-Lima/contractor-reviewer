import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { OnboardingService } from '../onboarding.service';
import { TourService } from './tour.service';
import type { RouteGuideKey } from '@contractai-review/shared';
import { AuthService } from '../../core/services/auth.service';

/** Maps URL patterns to route guide keys. */
function urlToRouteGuideKey(url: string): RouteGuideKey | null {
  // /workspaces/:id/documents exactly (not /documents/:documentId)
  const wsDocListMatch = url.match(/^\/workspaces\/[^/]+\/documents\/?$/);
  if (wsDocListMatch) return 'documents_list';

  // /workspaces/:id/documents/:documentId - document view, not documents list
  if (url.match(/^\/workspaces\/[^/]+\/documents\/[^/]+/)) return null;

  if (url.match(/^\/workspaces\/[^/]+\/settings/)) return 'workspace_settings';
  if (url.match(/^\/workspaces\/[^/]+\/members/)) return 'members';
  if (url.match(/^\/workspaces\/[^/]+\/privacy/)) return 'privacy';
  if (url.match(/^\/workspaces\/[^/]+\/audit/)) return 'audit';
  if (url === '/settings' || url.startsWith('/settings?')) return 'account_settings';

  return null;
}

@Injectable({
  providedIn: 'root',
})
export class RouteGuideService {
  private router = inject(Router);
  private onboardingService = inject(OnboardingService);
  private tourService = inject(TourService);
  private authService = inject(AuthService);

  private readonly DELAY_MS = 500;
  private readonly STATE_LOAD_MAX_RETRIES = 40; // ~6s at 150ms
  private pendingKeys = new Set<string>();

  init(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => this.onNavigationEnd(event));

    // Process current URL on init (handles initial load if we subscribed after first NavigationEnd)
    setTimeout(
      () => this.tryShowTourForUrl(this.router.url.split('?')[0]),
      this.DELAY_MS + 300,
    );
  }

  private onNavigationEnd(event: NavigationEnd): void {
    this.tryShowTourForUrl(event.urlAfterRedirects.split('?')[0]);
  }

  private tryShowTourForUrl(url: string, stateLoadRetries = 0): void {
    if (!this.authService.isAuthenticated()) return;

    const key = urlToRouteGuideKey(url);
    if (!key) return;

    // Wait for onboarding state to load before checking visited status (avoids race on page refresh)
    if (!this.onboardingService.stateLoadAttempted()) {
      if (stateLoadRetries >= this.STATE_LOAD_MAX_RETRIES) return;
      setTimeout(() => this.tryShowTourForUrl(url, stateLoadRetries + 1), 150);
      return;
    }

    // Only gate on visitedRoutes; show contextual tours regardless of main onboarding completed/dismissed
    if (this.onboardingService.hasVisitedRoute(key)) return;
    if (this.pendingKeys.has(key)) return;

    this.pendingKeys.add(key);
    this.onboardingService.markRouteVisited(key);

    setTimeout(() => {
      this.pendingKeys.delete(key);
      this.tourService.startContextualTour(key);
    }, this.DELAY_MS);
  }
}
