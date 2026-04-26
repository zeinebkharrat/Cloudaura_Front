import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs';
import type { CurrencyRatesSnapshot, DisplayCurrency } from '../currency.types';

const STORAGE_KEY = 'yallatn_display_currency';

interface RatesApiDto {
  baseCurrency: string;
  rates: Record<string, number>;
  source: CurrencyRatesSnapshot['source'];
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/currency';

  /** Bumped when selection or rates change so OnPush views can markForCheck via effect. */
  readonly displayRevision = signal(0);

  readonly selectedCode = signal<DisplayCurrency>(this.readInitialCode());
  readonly snapshot = signal<CurrencyRatesSnapshot | null>(null);
  readonly ratesLoading = signal(false);
  readonly ratesError = signal<string | null>(null);

  constructor() {
    this.refreshRatesFromServer();
  }

  setDisplayCurrency(code: DisplayCurrency): void {
    this.selectedCode.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore quota / private mode */
    }
    this.bump();
  }

  /** Rate from 1 unit of base (TND) to {@code code}, if known. */
  rateFor(code: DisplayCurrency): number | null {
    if (code === 'TND') {
      return 1;
    }
    const r = this.snapshot()?.rates?.[code];
    return r != null && r > 0 ? r : null;
  }

  /**
    * Example: {@code 120 TND ~ 35 €} when the user prefers EUR; {@code 120 TND} when TND is selected.
   */
  formatDual(amountTnd: number): string {
    const roundedTnd = this.roundMoney(amountTnd);
    const tndPart = `${this.formatNumber(roundedTnd)} TND`;
    const pref = this.selectedCode();
    if (pref === 'TND') {
      return tndPart;
    }
    const rate = this.rateFor(pref);
    if (rate == null) {
      return tndPart;
    }
    const converted = this.roundMoney(amountTnd * rate);
    const sym = SYMBOLS[pref];
    return `${tndPart} ~ ${this.formatNumber(converted)} ${sym}`;
  }

  refreshRatesFromServer(): void {
    this.ratesLoading.set(true);
    this.ratesError.set(null);
    this.http
      .get<RatesApiDto>(`${this.api}/rates`)
      .pipe(
        tap((dto) => {
          this.snapshot.set({
            baseCurrency: dto.baseCurrency,
            rates: dto.rates ?? {},
            source: dto.source,
            updatedAt: dto.updatedAt,
          });
        }),
        catchError((err: unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: string }).message)
              : 'Could not load exchange rates';
          this.ratesError.set(msg);
          return [];
        }),
        finalize(() => {
          this.ratesLoading.set(false);
          this.bump();
        })
      )
      .subscribe();
  }

  private bump(): void {
    this.displayRevision.update((v) => v + 1);
  }

  private readInitialCode(): DisplayCurrency {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'TND' || saved === 'EUR' || saved === 'USD') {
        return saved;
      }
    } catch {
      /* ignore */
    }
    return this.detectFromLocale();
  }

  private detectFromLocale(): DisplayCurrency {
    if (typeof navigator === 'undefined') {
      return 'TND';
    }
    const lang = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
    if (lang.startsWith('fr') || lang.startsWith('de') || lang.startsWith('it') || lang.startsWith('es') || lang.startsWith('nl')) {
      return 'EUR';
    }
    if (lang === 'en-us' || lang.startsWith('en-us') || lang === 'en-ca') {
      return 'USD';
    }
    return 'TND';
  }

  private formatNumber(n: number): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
  }

  private roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
  }
}

const SYMBOLS: Record<Exclude<DisplayCurrency, 'TND'>, string> = {
  EUR: '€',
  USD: '$',
};
