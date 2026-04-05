import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './core/api-url';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/api/payment`;

  createCheckoutSession(eventName: string, amount: number): Observable<{ id: string }> {
    // Stripe attend des centimes, donc on multiplie par 100
    const body = { eventName, amount: amount * 100 };
    return this.http.post<{ id: string }>(`${this.apiUrl}/create-session`, body);
  }
}