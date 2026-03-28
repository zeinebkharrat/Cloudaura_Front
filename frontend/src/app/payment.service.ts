import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
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
}