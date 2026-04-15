import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Event } from './models/event';
import { API_BASE_URL, API_FALLBACK_ORIGIN } from './core/api-url';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private apiUrl = `${API_BASE_URL}/api/events`;

  constructor(private http: HttpClient) { }

  getEvents(): Observable<Event[]> {
    const fallback = `${API_FALLBACK_ORIGIN}/api/events`;
    const canTryFallback = API_BASE_URL === '';

    return this.http.get<any>(this.apiUrl).pipe(
      map((res) => this.normalizeEventsResponse(res)),
      catchError((primaryError) => {
        if (!canTryFallback) {
          return throwError(() => primaryError);
        }
        return this.http.get<any>(fallback).pipe(
          map((res) => this.normalizeEventsResponse(res)),
          catchError((fallbackError) => throwError(() => fallbackError))
        );
      })
    );
  }

  private normalizeEventsResponse(res: any): Event[] {
    const list = Array.isArray(res)
      ? res
      : res?.data ?? res?.content ?? res?.events ?? res?.items ?? res?.results ?? [];

    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .map((raw) => {
        const source = raw?.event ?? raw;
        const eventId = source?.eventId ?? source?.event_id ?? source?.id;
        const title = source?.title ?? source?.name ?? source?.eventTitle ?? 'Untitled event';
        const eventType = source?.eventType ?? source?.event_type ?? source?.type ?? 'General';
        const venue = source?.venue ?? source?.location ?? source?.place ?? 'TBA';
        const status = source?.status ?? source?.state ?? 'PLANNED';
        const imageUrl = source?.imageUrl ?? source?.image_url ?? source?.image ?? undefined;
        const startDate = source?.startDate ?? source?.start_date ?? source?.date ?? source?.start ?? '';
        const endDate = source?.endDate ?? source?.end_date ?? source?.date ?? source?.end ?? '';
        const price = source?.price != null ? Number(source.price) : undefined;

        return {
          eventId,
          title,
          eventType,
          startDate,
          endDate,
          venue,
          status,
          imageUrl,
          price,
          city: source?.city ?? { cityId: 0 },
        } as Event;
      })
      .filter((event) => !!event.title);
  }

  // Ajoute cette méthode pour le POST
  createEvent(event: Event): Observable<Event> {
    return this.http.post<Event>(this.apiUrl, event);
  }

  // Ajoute cette méthode pour le PUT
  updateEvent(id: number, event: Event): Observable<Event> {
    return this.http.put<Event>(`${this.apiUrl}/${id}`, event);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  createCheckoutSession(data: {
    event_id: number | undefined;
    amount: number;
    eventName: string;
    presentmentCurrency?: string;
  }): Observable<{ sessionId: string; sessionUrl?: string }> {
    return this.http.post<{ sessionId: string; sessionUrl?: string }>(
      `${this.apiUrl}/create-checkout-session`,
      data
    );
  }

  finalizeCheckout(sessionId: string): Observable<{
    message?: string;
    eventReservationId?: number;
    eventId?: number;
  }> {
    return this.http.post<{
      message?: string;
      eventReservationId?: number;
      eventId?: number;
    }>(`${this.apiUrl}/finalize-checkout`, { sessionId });
  }

  createReservation(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reservations`, data);
  }

  extractEventFromImage(file: File): Observable<{ text: string; message?: string }> {
    const createFormData = () => {
      const formData = new FormData();
      formData.append('file', file);
      return formData;
    };

    const adminUrl = `${this.apiUrl}/admin/extract-from-image`;
    const legacyUrl = `${this.apiUrl}/extract-from-image`;

    return this.http.post<{ text: string; message?: string }>(adminUrl, createFormData()).pipe(
      catchError((err) => {
        const message = String(err?.error?.message ?? err?.error?.error ?? '').toLowerCase();
        const shouldFallback = err?.status === 404 || message.includes('no static resource');

        if (!shouldFallback) {
          return throwError(() => err);
        }

        return this.http.post<{ text: string; message?: string }>(legacyUrl, createFormData());
      })
    );
  }

  generateEventPoster(data: {
    title: string;
    city: string;
    category: string;
    description?: string;
  }): Observable<{ prompt: string; imageUrl: string; message?: string }> {
    const adminUrl = `${this.apiUrl}/admin/generate-poster`;
    const legacyUrl = `${this.apiUrl}/generate-poster`;

    return this.http.post<{ prompt: string; imageUrl: string; message?: string }>(adminUrl, data).pipe(
      catchError((err) => {
        const message = String(err?.error?.message ?? err?.error?.error ?? '').toLowerCase();
        const shouldFallback = err?.status === 404 || message.includes('no static resource');

        if (!shouldFallback) {
          return throwError(() => err);
        }

        return this.http.post<{ prompt: string; imageUrl: string; message?: string }>(legacyUrl, data);
      })
    );
  }
}