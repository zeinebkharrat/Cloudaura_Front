import { CurrencyService } from '../../core/services/currency.service';
import type { DisplayCurrency } from '../../core/currency.types';
import type { FlightDto } from './flight.models';

/** Same heuristic as transport booking fallback (per seat, TND). */
export function estimateSeatPriceTnd(durationMinutes: number): number {
  const base = 48 + durationMinutes * 0.36;
  return Math.round(Math.min(180, Math.max(58, base)) * 100) / 100;
}

export function estimateDurationMinutes(f: FlightDto): number {
  const dep = Date.parse(f.departureTime || '');
  const arr = Date.parse(f.arrivalTime || '');
  if (Number.isFinite(dep) && Number.isFinite(arr) && arr > dep) {
    return Math.max(45, Math.round((arr - dep) / 60000));
  }
  return 95;
}

/**
 * Rates from {@link CurrencyService} convert TND → EUR/USD (multiply).
 * Reverse: foreign amount → TND by dividing by that rate.
 */
export function foreignAmountToTnd(amount: number, currency: string | null | undefined, currencyService: CurrencyService): number | null {
  if (!Number.isFinite(amount)) return null;
  const c = (currency ?? '').trim().toUpperCase();
  if (!c || c === 'TND') return amount;
  if (c === 'EUR' || c === 'USD') {
    const rate = currencyService.rateFor(c as DisplayCurrency);
    if (rate != null && rate > 0) {
      return Math.round((amount / rate) * 100) / 100;
    }
  }
  return null;
}

/** Prefer API offer total (any currency); otherwise estimate from leg duration. */
export function effectivePriceTnd(f: FlightDto, currencyService: CurrencyService): number {
  const rawAmt = f.totalAmount?.trim();
  const cur = f.totalCurrency?.trim();
  if (rawAmt && cur) {
    const parsed = Number.parseFloat(rawAmt.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      const tnd = foreignAmountToTnd(parsed, cur, currencyService);
      if (tnd != null) return tnd;
    }
  }
  return estimateSeatPriceTnd(estimateDurationMinutes(f));
}

export function priceUsesEstimate(f: FlightDto): boolean {
  return !f.totalAmount?.trim();
}

/**
 * Per-seat price for synthetic PLANE booking: total offer ÷ passengers when API total exists.
 */
export function pricePerSeatForBooking(f: FlightDto, passengerCount: number, currencyService: CurrencyService): number {
  const n = Math.max(1, passengerCount);
  if (f.totalAmount?.trim()) {
    const totalTnd = effectivePriceTnd(f, currencyService);
    return Math.round((totalTnd / n) * 100) / 100;
  }
  return estimateSeatPriceTnd(estimateDurationMinutes(f));
}

/** Hide cancelled and flights that have already landed or clearly departed without an in-flight window. */
export function isFlightPastOrCompleted(f: FlightDto): boolean {
  const st = (f.status || '').toLowerCase();
  if (st === 'cancelled') return true;
  if ((f.statusCategory || '').toUpperCase() === 'CANCELLED') return true;

  const now = Date.now();
  const arrT = f.arrivalTime ? Date.parse(f.arrivalTime) : NaN;
  if (Number.isFinite(arrT) && arrT < now) return true;

  const depT = f.departureTime ? Date.parse(f.departureTime) : NaN;
  if (Number.isFinite(depT) && depT < now) {
    if (Number.isFinite(arrT) && arrT >= now) return false;
    return true;
  }
  return false;
}

export function filterBookableFlights(flights: FlightDto[]): FlightDto[] {
  return flights.filter((f) => !isFlightPastOrCompleted(f));
}
