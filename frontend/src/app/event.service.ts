import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Event } from './models/event';
<<<<<<< HEAD
import { API_BASE_URL } from './core/api-url';
=======
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236

@Injectable({
  providedIn: 'root'
})
export class EventService {
<<<<<<< HEAD
  private apiUrl = `${API_BASE_URL}/api/events`;
=======
  private apiUrl = 'http://localhost:9091/api/events'; // Vérifie ton URL backend
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236

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
<<<<<<< HEAD

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

  createReservation(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reservations`, data);
  }
=======
  createReservation(data: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/reservations`, data);
}
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
}