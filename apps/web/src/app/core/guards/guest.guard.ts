import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ROUTES } from '../routes';
import { AuthService } from '../services/auth.service';

/**
 * Guard that prevents authenticated users from accessing auth routes (login/register)
 * Redirects authenticated users to workspaces
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true; // Allow access if not authenticated
  }

  router.navigate([ROUTES.WORKSPACES]);
  return false;
};
