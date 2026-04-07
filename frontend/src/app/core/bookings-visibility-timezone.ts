/**
 * Fuseau utilisé pour interpréter les dates « calendrier seul » des réservations (hôtels, etc.)
 * et les comparer à l’heure réelle — aligné sur la Tunisie (YallaTN).
 */
export const BOOKINGS_VISIBILITY_TIMEZONE = 'Africa/Tunis';

function zonedWallCalendarAndTime(utcMs: number, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => +parts.find((p) => p.type === type)!.value;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function wallTimeMatchesUtc(
  utcMs: number,
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string
): boolean {
  const p = zonedWallCalendarAndTime(utcMs, timeZone);
  return p.year === y && p.month === mo && p.day === d && p.hour === hh && p.minute === mm;
}

/**
 * Convertit une date/heure « murale » (calendrier tunisien) en instant UTC (ms).
 * Chemin rapide : décalage typique UTC+1 (Tunisie, sans heure d’été depuis 2009).
 * Si l’écart ne correspond pas (règle future), recherche par pas d’1 min sur une fenêtre raisonnable.
 */
export function wallTimeTunisiaToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  const tz = BOOKINGS_VISIBILITY_TIMEZONE;
  let t = Date.UTC(year, month - 1, day, hour - 1, minute, 0, 0);
  if (wallTimeMatchesUtc(t, year, month, day, hour, minute, tz)) {
    return t;
  }
  const start = Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 3600000;
  for (let u = start; u < start + 40 * 3600000; u += 60000) {
    if (wallTimeMatchesUtc(u, year, month, day, hour, minute, tz)) {
      return u;
    }
  }
  return t;
}

/** `YYYY-MM-DD` (strict). */
export function isIsoDateOnly(s: string): boolean {
  return s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
