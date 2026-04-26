import type { City } from '../models/travel.models';

/** Maps canonical city name keys (ASCII) to primary Tunisian airport IATA for flight search. */
export const TUNISIA_AIRPORT_IATA_BY_CITY_KEY: Record<string, string> = {
  tunis: 'TUN',
  sousse: 'NBE',
  sfax: 'SFA',
  djerba: 'DJE',
  medenine: 'DJE',
  mednine: 'DJE',
  midoun: 'DJE',
  zarzis: 'DJE',
  tataouine: 'DJE',
  kebili: 'TOE',
  douz: 'TOE',
  mahdia: 'MIR',
  kairouan: 'NBE',
  bizerte: 'TUN',
  nabeul: 'NBE',
  monastir: 'MIR',
  enfidha: 'NBE',
  hammamet: 'NBE',
  tozeur: 'TOE',
  gafsa: 'GAF',
  tabarka: 'TBJ',
  gabes: 'GAE',
};

export function normalizeCityKeyForAirport(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Primary airport IATA for a seeded Tunisia governorate city, when known. */
export function tunisiaAirportIataForCity(city: City | null): string | null {
  if (!city?.name) {
    return null;
  }
  const key = normalizeCityKeyForAirport(city.name);
  return TUNISIA_AIRPORT_IATA_BY_CITY_KEY[key] ?? null;
}
