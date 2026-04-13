import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './core/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token();
  const isAbsoluteUrl = /^https?:\/\//i.test(req.url);
  const hasKnownApiPrefix =
    req.url.startsWith('/api') ||
    req.url.startsWith('/post') ||
    req.url.startsWith('/comment') ||
    req.url.startsWith('/like') ||
    req.url.startsWith('/media') ||
    req.url.startsWith('/follow') ||
    req.url.startsWith('/saved-post') ||
    req.url.startsWith('/chatroom');

  let isOwnBackendAbsolute = false;
  if (isAbsoluteUrl) {
    try {
      const parsed = new URL(req.url);
      const path = parsed.pathname;
      const isLocalBackendHost = parsed.hostname === 'localhost' && parsed.port === '9091';
      const hasBackendPrefix =
        path.startsWith('/api/') ||
        path.startsWith('/post/') ||
        path.startsWith('/comment/') ||
        path.startsWith('/like/') ||
        path.startsWith('/media/') ||
        path.startsWith('/follow/') ||
        path.startsWith('/saved-post/') ||
        path.startsWith('/chatroom/');

      isOwnBackendAbsolute = isLocalBackendHost && hasBackendPrefix;
    } catch {
      isOwnBackendAbsolute = false;
    }
  }

  const shouldAttachToken = hasKnownApiPrefix || isOwnBackendAbsolute;

  if (
    !token ||
    req.url.includes('/api/auth/signin') ||
    req.url.includes('/api/auth/signup') ||
    !shouldAttachToken
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
