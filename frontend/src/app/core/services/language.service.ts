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
    this.persistEnglishOnlyPreference();
    return 'en';
  }

  applyDocumentDirection(lang: AppLang): void {
    void lang;
    if (typeof document === 'undefined') {
      return;
    }
    const el = document.documentElement;
    el.setAttribute('lang', 'en');
    el.setAttribute('translate', 'no');
    el.setAttribute('dir', 'ltr');
    el.style.removeProperty('font-family');
  }

  setLanguage(lang: AppLang): void {
    void lang;
    const enforced: AppLang = 'en';
    this.currentLang.set(enforced);
    this.langChangeRaw$.next(enforced);
    this.persistEnglishOnlyPreference();
    this.applyDocumentDirection(enforced);
    this.translate.use(enforced).subscribe(() => {
      this.langChanged$.next(enforced);
    });
  }

  /** Call after initial `translate.use()` in APP_INITIALIZER so late subscribers get the current code. */
  notifyLanguageReady(code: AppLang): void {
    const enforced: AppLang = 'en';
    void code;
    this.langChangeRaw$.next(enforced);
    this.langChanged$.next(enforced);
  }

  private persistEnglishOnlyPreference(): void {
    try {
      localStorage.setItem(STORAGE_KEY, 'en');
    } catch {
      /* ignore */
    }
  }
}
