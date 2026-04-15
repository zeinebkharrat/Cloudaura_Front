import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../services/language.service';

/**
 * Appends {@code lang} to every same-origin {@code /api/**} request so the backend can return catalog-localized payloads.
 */
function apiPathname(url: string): string {
  const base = url.split(/[?#]/, 1)[0];
  if (base.includes('://')) {
    try {
      return new URL(base).pathname;
    } catch {
      return base;
    }
  }
  return base.startsWith('/') ? base : `/${base}`;
}

export const langHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const path = apiPathname(req.url);
  if (!path.startsWith('/api/')) {
    return next(req);
  }
  if (path.startsWith('/api/translate')) {
    return next(req);
  }
  // Back-office : ne pas envoyer `lang` — le serveur ignore le catalogue catalogue sur ces routes ;
  // évite aussi qu'un `lang` résiduel ne vienne d'une autre zone de l'app.
  if (path.startsWith('/api/admin/') || path === '/api/admin' || path.startsWith('/api/events/admin/')) {
    return next(req);
  }
  // Toujours synchroniser sur la langue UI (évite les requêtes oubliées ou un `lang` périmé).
  const lang = inject(LanguageService).currentLang();
  return next(req.clone({ params: req.params.set('lang', lang) }));
};
