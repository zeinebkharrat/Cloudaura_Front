import { FlightOfferDto } from './flight.models';

export type StatusFilterKey = 'all' | 'on_time' | 'delayed' | 'scheduled';
export type SortKey = 'departure' | 'airline' | 'status';

/** Badge: delayed = danger (red), on time = success (green), scheduled = warn (orange) — PrimeNG 18 Tag severity. */
export function flightBadge(f: FlightOfferDto): { label: string; severity: 'success' | 'warn' | 'danger' | 'secondary' } {
  const cat = (f.statusCategory || '').toUpperCase();
  const st = (f.status || '').toLowerCase();

  if (cat === 'CANCELLED') {
    return { label: 'Cancelled', severity: 'danger' };
  }
  if (cat === 'DELAYED') {
    return { label: 'Delayed', severity: 'danger' };
  }
  if (st === 'scheduled') {
    return { label: 'Scheduled', severity: 'warn' };
  }
  if (cat === 'ON_TIME' || st === 'active' || st === 'landed') {
    if (st === 'landed') return { label: 'Landed', severity: 'success' };
    if (st === 'active') return { label: 'In flight', severity: 'success' };
    return { label: 'On time', severity: 'success' };
  }
  return { label: f.status ? f.status : 'Unknown', severity: 'secondary' };
}

export function matchesStatusFilter(f: FlightOfferDto, key: StatusFilterKey): boolean {
  if (key === 'all') return true;
  const b = flightBadge(f);
  if (key === 'on_time') return b.severity === 'success';
  if (key === 'delayed') return b.severity === 'danger';
  if (key === 'scheduled') return b.label === 'Scheduled';
  return true;
}

export function compareFlights(a: FlightOfferDto, b: FlightOfferDto, sort: SortKey): number {
  if (sort === 'airline') {
    return (a.airline || '').localeCompare(b.airline || '', undefined, { sensitivity: 'base' });
  }
  if (sort === 'status') {
    return flightBadge(a).label.localeCompare(flightBadge(b).label, undefined, { sensitivity: 'base' });
  }
  const ta = a.departureTime ? Date.parse(a.departureTime) : 0;
  const tb = b.departureTime ? Date.parse(b.departureTime) : 0;
  return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
}
