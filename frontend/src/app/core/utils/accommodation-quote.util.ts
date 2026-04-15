import { Accommodation, Room } from '../models/travel.models';

export type AccommodationRoomCategory = 'SINGLE' | 'DOUBLE' | 'SUITE';

export function suiteEligible(acc: { rating: number }): boolean {
  return acc.rating >= 4;
}

/** Max guests the UI should allow (from real rooms or synthetic rules). */
export function maxSelectableGuests(acc: Accommodation): number {
  const rooms = (acc.rooms ?? []).filter((r) => r.available !== false);
  if (rooms.length > 0) {
    return Math.max(1, ...rooms.map((r) => r.capacity ?? 0));
  }
  return suiteEligible(acc) ? 4 : 2;
}

export function maxGuestsForCategory(cat: AccommodationRoomCategory, acc: Accommodation): number {
  const r = resolveRoomForCategory(acc, cat);
  if (r != null) return Math.max(1, r.capacity);
  return cat === 'SINGLE' ? 1 : cat === 'DOUBLE' ? 2 : 4;
}

/** Pick a concrete bookable room for the UI category (for price + roomId quote). */
export function resolveRoomForCategory(acc: Accommodation, cat: AccommodationRoomCategory): Room | null {
  const rooms = (acc.rooms ?? []).filter((r) => r.available !== false);
  if (rooms.length === 0) return null;
  const byCapAsc = [...rooms].sort((a, b) => a.capacity - b.capacity);
  if (cat === 'SINGLE') {
    return rooms.find((r) => r.capacity === 1) ?? byCapAsc[0];
  }
  if (cat === 'DOUBLE') {
    return (
      rooms.find((r) => r.capacity === 2) ??
      rooms.find((r) => r.capacity >= 2) ??
      byCapAsc[0]
    );
  }
  const big = rooms.filter((r) => r.capacity >= 4);
  if (big.length > 0) {
    return [...big].sort((a, b) => b.price - a.price)[0];
  }
  return [...rooms].sort((a, b) => b.price - a.price)[0];
}

export function nightlyRateForCategory(acc: Accommodation, cat: AccommodationRoomCategory): number {
  const r = resolveRoomForCategory(acc, cat);
  if (r != null) return r.price;
  const base = acc.pricePerNight || 0;
  return cat === 'SUITE' ? base * 2 : base;
}

export function quoteRoomId(acc: Accommodation, cat: AccommodationRoomCategory): number | null {
  const id = resolveRoomForCategory(acc, cat)?.id;
  return id != null ? id : null;
}

/** Smallest UI category that can fit `guests` (may still need guest clamp if property max is lower). */
export function minCategoryForGuests(guests: number, acc: Accommodation): AccommodationRoomCategory {
  if (guests <= 1) return 'SINGLE';
  if (guests <= 2) return 'DOUBLE';
  if (suiteEligible(acc) && syntheticSuiteOffered(acc)) return 'SUITE';
  return 'DOUBLE';
}

function syntheticSuiteOffered(acc: Accommodation): boolean {
  const rooms = (acc.rooms ?? []).filter((r) => r.available !== false);
  if (rooms.length === 0) return true;
  return rooms.some((r) => (r.capacity ?? 0) >= 3);
}
