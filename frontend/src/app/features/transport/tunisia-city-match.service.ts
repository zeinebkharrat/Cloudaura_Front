import { Injectable } from '@angular/core';
import { City } from '../../core/models/travel.models';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class TunisiaCityMatchService {
  /**
   * Choisit la ville du catalogue la plus proche des coordonnées GPS (Haversine).
   * Aucune clé API : données OpenStreetMap uniquement côté carte ; géoloc navigateur ici.
   */
  async reverseGeocodeThenNearestCity(lat: number, lng: number, cities: City[]): Promise<City | null> {
    return this.nearestCatalogCity(lat, lng, cities);
  }

  nearestCatalogCity(lat: number, lng: number, cities: City[]): City | null {
    let best: City | null = null;
    let bestKm = Infinity;
    for (const c of cities) {
      const clat = c.latitude ?? c.coords?.lat;
      const clng = c.longitude ?? c.coords?.lng;
      if (clat == null || clng == null) {
        continue;
      }
      const d = haversineKm(lat, lng, clat, clng);
      if (d < bestKm) {
        bestKm = d;
        best = c;
      }
    }
    return best;
  }
}
