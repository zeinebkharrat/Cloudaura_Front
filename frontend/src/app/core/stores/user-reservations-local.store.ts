import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { AccommodationReservation, TransportReservation } from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class UserReservationsLocalStore {
  private readonly auth = inject(AuthService);

  private transportKey(): string {
    const id = this.auth.currentUser()?.id ?? 'anon';
    return `yalla_local_transport_${id}`;
  }

  private hebergementKey(): string {
    const id = this.auth.currentUser()?.id ?? 'anon';
    return `yalla_local_hebergement_${id}`;
  }

  readTransport(): TransportReservation[] {
    return this.readJson<TransportReservation[]>(this.transportKey(), []);
  }

  readAccommodation(): AccommodationReservation[] {
    return this.readJson<AccommodationReservation[]>(this.hebergementKey(), []);
  }

  addTransport(reservation: TransportReservation): void {
    const list = this.readTransport().filter(
      (r) =>
        r.transportReservationId !== reservation.transportReservationId ||
        r.reservationRef !== reservation.reservationRef
    );
    list.unshift(reservation);
    this.writeJson(this.transportKey(), list);
  }

  addAccommodation(reservation: AccommodationReservation): void {
    const list = this.readAccommodation().filter(
      (r) => r.id !== reservation.id || r.reservationRef !== reservation.reservationRef
    );
    list.unshift(reservation);
    this.writeJson(this.hebergementKey(), list);
  }

  removeTransport(id: number): void {
    const list = this.readTransport().filter((r) => r.transportReservationId !== id);
    this.writeJson(this.transportKey(), list);
  }

  removeAccommodation(id: number): void {
    const list = this.readAccommodation().filter((r) => r.id !== id);
    this.writeJson(this.hebergementKey(), list);
  }

  pruneTransport(keep: (reservation: TransportReservation) => boolean): void {
    const list = this.readTransport().filter(keep);
    this.writeJson(this.transportKey(), list);
  }

  pruneAccommodation(keep: (reservation: AccommodationReservation) => boolean): void {
    const list = this.readAccommodation().filter(keep);
    this.writeJson(this.hebergementKey(), list);
  }

  mergeTransport(server: TransportReservation[]): TransportReservation[] {
    const local = this.readTransport();
    const key = (r: TransportReservation) =>
      `${r.transportReservationId}:${r.reservationRef ?? ''}`;
    const seen = new Set(server.map(key));
    const merged = [...server];
    for (const item of local) {
      if (!seen.has(key(item))) {
        merged.push(item);
        seen.add(key(item));
      }
    }
    return merged;
  }

  mergeAccommodation(server: AccommodationReservation[]): AccommodationReservation[] {
    const local = this.readAccommodation();
    const key = (r: AccommodationReservation) => `${r.id}:${r.reservationRef ?? ''}`;
    const seen = new Set(server.map(key));
    const merged = [...server];
    for (const item of local) {
      if (!seen.has(key(item))) {
        merged.push(item);
        seen.add(key(item));
      }
    }
    return merged;
  }

  private readJson<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  }
}
