import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
<<<<<<< HEAD
import { API_BASE_URL } from './core/api-url';
=======
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
<<<<<<< HEAD
  private apiUrl = `${API_BASE_URL}/api/payment`;

  createCheckoutSession(eventName: string, amount: number): Observable<{ id: string }> {
    // Stripe attend des centimes, donc on multiplie par 100
    const body = { eventName, amount: amount * 100 };
    return this.http.post<{ id: string }>(`${this.apiUrl}/create-session`, body);
  }
=======
  private apiUrl = 'http://localhost:9091/api/payment'; // L'URL de ton Spring Boot

createSession(data: { price: number, productName: string, eventId: number }) {
  // On multiplie par 100 pour Stripe (centimes)
  const amountInCents = Math.round(data.price * 100);

  return this.http.post<{url: string}>(`${this.apiUrl}/create-session`, {
    amount: amountInCents,
    productName: data.productName, // Ce nom doit être identique au champ dans ton DTO Java
    eventId: data.eventId
  });
}
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
}