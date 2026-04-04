import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EventService } from './event.service';
import { AuthService } from './core/auth.service';
import { extractApiErrorMessage } from './api-error.util';

@Component({
  standalone: true,
  selector: 'app-event-payment-success',
  imports: [CommonModule, RouterLink],
  template: `
    <main class="wrap">
      <div class="card" *ngIf="status === 'loading'">
        <p class="lead">Confirming your payment…</p>
      </div>
      <div class="card ok" *ngIf="status === 'ok'">
        <h1>You're in!</h1>
        <p>Your event booking is confirmed.</p>
        <p *ngIf="reservationId != null" class="ref">Reservation #{{ reservationId }}</p>
        <a routerLink="/evenements" class="btn">Back to events</a>
      </div>
      <div class="card err" *ngIf="status === 'error'">
        <h1>Could not confirm</h1>
        <p>{{ message }}</p>
        <a routerLink="/evenements" class="btn">Back to events</a>
      </div>
    </main>
  `,
  styles: [
    `
      .wrap {
        max-width: 520px;
        margin: 5rem auto;
        padding: 1.25rem;
      }
      .card {
        padding: 2rem;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e8edf3;
      }
      .lead {
        margin: 0;
        color: rgba(255, 255, 255, 0.75);
      }
      .ok h1 {
        margin: 0 0 0.75rem;
        color: #34d399;
        font-size: 1.5rem;
      }
      .err h1 {
        margin: 0 0 0.75rem;
        color: #f87171;
        font-size: 1.35rem;
      }
      .ref {
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
      }
      .btn {
        display: inline-block;
        margin-top: 1.25rem;
        padding: 0.65rem 1.25rem;
        border-radius: 10px;
        background: #f12545;
        color: #fff;
        text-decoration: none;
        font-weight: 600;
      }
    `,
  ],
})
export class EventPaymentSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly auth = inject(AuthService);

  status: 'loading' | 'ok' | 'error' = 'loading';
  message = '';
  reservationId: number | null = null;

  ngOnInit(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      this.status = 'error';
      this.message = 'Missing payment session. Please return to events and try booking again.';
      return;
    }
    if (!this.auth.token()) {
      this.status = 'error';
      this.message =
        'Sign in with the same account you used to book, then use the return link from Stripe or book again.';
      return;
    }
    this.eventService.finalizeCheckout(sessionId).subscribe({
      next: (res) => {
        this.status = 'ok';
        this.reservationId = res.eventReservationId ?? null;
      },
      error: (err: HttpErrorResponse) => {
        this.status = 'error';
        this.message = extractApiErrorMessage(err, 'Could not confirm payment.');
      },
    });
  }
}
