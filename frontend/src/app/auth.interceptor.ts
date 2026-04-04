import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './core/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token();
  const isAbsoluteUrl = /^https?:\/\//i.test(req.url);
  const isApiToOwnBackend = req.url.startsWith('/api') || req.url.includes('/api/');

  if (
    !token ||
    req.url.includes('/api/auth/signin') ||
    req.url.includes('/api/auth/signup') ||
    (isAbsoluteUrl && !isApiToOwnBackend)
  ) {
    return next(req);
  }

  const clonedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(clonedRequest);
};
