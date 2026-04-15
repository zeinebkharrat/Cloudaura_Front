export type DisplayCurrency = 'TND' | 'EUR' | 'USD';

export type CurrencyRateSource = 'LIVE' | 'CACHED' | 'EMERGENCY_FALLBACK';

export interface CurrencyRatesSnapshot {
  baseCurrency: string;
  rates: Record<string, number>;
  source: CurrencyRateSource;
  updatedAt: string | null;
}
