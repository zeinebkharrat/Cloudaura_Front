import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Event } from './models/event';
import { API_BASE_URL } from './core/api-url';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private apiUrl = `${API_BASE_URL}/api/events`;

  constructor(private http: HttpClient) { }

  getEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(this.apiUrl);
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
}