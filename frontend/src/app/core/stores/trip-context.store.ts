import { Injectable, signal, computed, effect } from '@angular/core';
import { City, Accommodation, Transport } from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class TripContextStore {
  selectedCityId = signal<number | null>(null);
  selectedCity = signal<City | null>(null);
  
  dates = signal<{ checkIn: string | null; checkOut: string | null; travelDate: string | null }>({
    checkIn: null,
    checkOut: null,
    travelDate: null
  });

  pax = signal<{ adults: number; children: number }>({ adults: 2, children: 0 });
  
  selectedAccommodation = signal<Accommodation | null>(null);
  selectedTransport = signal<Transport | null>(null);

  constructor() {
    this.loadFromSession();
    
    // Auto-save on changes
    effect(() => {
      this.saveToSession();
    });
  }

  setSelectedCity(id: number | null) {
    this.selectedCityId.set(id);
  }

  setDates(dates: Partial<{ checkIn: string; checkOut: string; travelDate: string }>) {
    this.dates.update(d => ({ ...d, ...dates }));
  }

  setPax(pax: { adults: number; children: number }) {
    this.pax.set(pax);
  }

  calculateNights = computed(() => {
    const { checkIn, checkOut } = this.dates();
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  private saveToSession() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('yalla_trip_context', JSON.stringify({
        selectedCityId: this.selectedCityId(),
        dates: this.dates(),
        pax: this.pax()
      }));
    }
  }

  private loadFromSession() {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('yalla_trip_context');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.selectedCityId.set(parsed.selectedCityId);
        this.dates.set(parsed.dates);
        this.pax.set(parsed.pax);
      }
    }
  }
}
