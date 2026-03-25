import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRoles = (route.data?.['roles'] as string[] | undefined) ?? [];

  if (requiredRoles.length === 0) {
    return true;
  }

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/signin']);
  }

  const hasRequiredRole = requiredRoles.some((role) => authService.hasRole(role));
  if (hasRequiredRole) {
    return true;
  }

  return router.createUrlTree(['/']);
};