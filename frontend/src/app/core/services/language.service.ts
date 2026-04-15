import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export type AppLang = 'fr' | 'en' | 'ar';

const STORAGE_KEY = 'yallatn_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly currentLang = signal<AppLang>('en');

  /** Emits after each successful `translate.use()` so the app can run change detection site-wide. */
  readonly langChanged$ = new BehaviorSubject<AppLang>('en');

  private readonly langChangeRaw$ = new Subject<AppLang>();

  /**
   * Debounced language code for heavy work (e.g. batch API translation).
   * Does not replace {@link #langChanged$} for ngx-translate refresh.
   */
  readonly langChangedDebounced$ = this.langChangeRaw$.pipe(debounceTime(300), distinctUntilChanged());

  /** Resolve language before first paint (no TranslateService dependency). */
  resolveInitialLanguageCode(): AppLang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'ar') {
        return stored;
      }
      if (stored === 'fr') {
        // Migrate previous default (French) to English unless user later picks another language.
        return 'en';
      }
    } catch {
      /* private mode */
    }
    return 'en';
  }

  applyDocumentDirection(lang: AppLang): void {
    if (typeof document === 'undefined') {
      return;
    }
    const el = document.documentElement;
    el.setAttribute('lang', lang);
    el.setAttribute('translate', 'no');
    el.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    if (lang === 'ar') {
      el.style.setProperty('font-family', "'Cairo', 'Outfit', sans-serif");
    } else {
      el.style.removeProperty('font-family');
    }
  }

  setLanguage(lang: AppLang): void {
    this.currentLang.set(lang);
    this.langChangeRaw$.next(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    this.applyDocumentDirection(lang);
    this.translate.use(lang).subscribe(() => {
      this.langChanged$.next(lang);
    });
  }

  /** Call after initial `translate.use()` in APP_INITIALIZER so late subscribers get the current code. */
  notifyLanguageReady(code: AppLang): void {
    this.langChangeRaw$.next(code);
    this.langChanged$.next(code);
  }
}
