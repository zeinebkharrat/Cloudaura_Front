import { Injectable, signal, computed, effect } from '@angular/core';
import { City, Accommodation, Transport } from '../models/travel.models';
import { AccommodationRoomCategory } from '../utils/accommodation-quote.util';

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

  /** Room category chosen on the property details page (drives quote + checkout). */
  accommodationRoomCategory = signal<AccommodationRoomCategory>('DOUBLE');
  /** Concrete room id for API when it matches the selected category (null = let checkout pick). */
  accommodationQuoteRoomId = signal<number | null>(null);

  /** Driving route distance (km) for taxi pricing / Stripe checkout. */
  transportRouteKm = signal<number | null>(null);
  transportRouteDurationSec = signal<number | null>(null);
  transportRouteDurationMin = computed(() => {
    const sec = this.transportRouteDurationSec();
    if (sec == null || sec <= 0) {
      return null;
    }
    return Math.max(1, Math.round(sec / 60));
  });
  /** Car rental duration in days (CAR pricing). */
  transportRentalDays = signal<number>(1);

  /**
   * Last input from transport "Find your ride" — used to hydrate `/transport/flights`
   * when query params are incomplete.
   */
  transportSearchLeg = signal<{
    fromCityId: number | null;
    toCityId: number | null;
    travelDateIso: string | null;
    passengers: number;
  }>({
    fromCityId: null,
    toCityId: null,
    travelDateIso: null,
    passengers: 1,
  });

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

  setPassengers(passengers: number) {
    const adults = Math.max(1, Math.floor(passengers || 1));
    this.pax.set({ adults, children: this.pax().children });
  }

  setAccommodationRoomQuote(category: AccommodationRoomCategory, roomId: number | null) {
    this.accommodationRoomCategory.set(category);
    this.accommodationQuoteRoomId.set(roomId);
  }

  setTransportRouteMetrics(distanceKm: number | null, durationSeconds: number | null) {
    this.transportRouteKm.set(distanceKm);
    this.transportRouteDurationSec.set(durationSeconds);
  }

  setTransportRentalDays(days: number) {
    this.transportRentalDays.set(Math.max(1, Math.floor(days)));
  }

  setTransportSearchLeg(
    patch: Partial<{
      fromCityId: number | null;
      toCityId: number | null;
      travelDateIso: string | null;
      passengers: number;
    }>,
  ) {
    this.transportSearchLeg.update((prev) => ({ ...prev, ...patch }));
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
        pax: this.pax(),
        accommodationRoomCategory: this.accommodationRoomCategory(),
        accommodationQuoteRoomId: this.accommodationQuoteRoomId(),
        transportRouteKm: this.transportRouteKm(),
        transportRouteDurationSec: this.transportRouteDurationSec(),
        transportRentalDays: this.transportRentalDays(),
        transportSearchLeg: this.transportSearchLeg(),
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
        if (parsed.accommodationRoomCategory) {
          this.accommodationRoomCategory.set(parsed.accommodationRoomCategory);
        }
        if (parsed.accommodationQuoteRoomId !== undefined) {
          this.accommodationQuoteRoomId.set(parsed.accommodationQuoteRoomId);
        }
        if (parsed.transportRouteKm !== undefined) {
          this.transportRouteKm.set(parsed.transportRouteKm);
        }
        if (parsed.transportRouteDurationSec !== undefined) {
          this.transportRouteDurationSec.set(parsed.transportRouteDurationSec);
        }
        if (parsed.transportRentalDays != null) {
          this.transportRentalDays.set(parsed.transportRentalDays);
        }
        if (parsed.transportSearchLeg != null) {
          this.transportSearchLeg.set(parsed.transportSearchLeg);
        }
      }
    }
  }
}
