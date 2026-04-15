import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivityReservationResponse } from './explore.models';
import { extractApiErrorMessage } from '../api-error.util';

@Component({
  standalone: true,
  selector: 'app-activity-payment-success',
  imports: [CommonModule, RouterLink],
  template: `
    <main class="payment-page">
      <div class="payment-inner animate-in">
      <header class="payment-head">
        <p class="kicker">Paiement securise</p>
        <h1 class="title">YallaTN<span class="accent">+</span> · <span class="sub">activities</span></h1>
      </header>

      <div class="state-card" *ngIf="status === 'loading'">
        <p class="lead">Confirming your activity payment...</p>
      </div>

      <div class="state-card ok" *ngIf="status === 'ok' && reservation">
        <div class="brand">
          <img src="assets/logo/yallatn-logo.png" alt="YallaTN logo" />
        </div>
        <h2>Payment confirmed</h2>
        <p>Your activity booking is now confirmed.</p>

        <div class="meta">
          <p><strong>Activity:</strong> {{ reservation.activityName }}</p>
          <p><strong>Date:</strong> {{ reservation.reservationDate }}</p>
          <p><strong>Participants:</strong> {{ reservation.numberOfPeople }}</p>
          <p><strong>Total paid:</strong> {{ reservation.totalPrice | number: '1.2-2' }} TND</p>
        </div>

        <div class="qr" *ngIf="qrObjectUrl">
          <img [src]="qrObjectUrl" alt="Booking QR receipt" />
          <small>Scan to open the same PDF confirmation</small>
        </div>

        <div class="actions">
          <button type="button" class="btn" (click)="downloadPdf()" [disabled]="downloadingPdf">
            {{ downloadingPdf ? 'Preparing PDF...' : 'Open PDF confirmation' }}
          </button>
          <a [routerLink]="['/activities', reservation.activityId]" class="btn secondary">Back to activity</a>
        </div>
      </div>

      <div class="state-card err" *ngIf="status === 'error'">
        <h2>Could not confirm payment</h2>
        <p>{{ message }}</p>
        <a routerLink="/services/activities" class="btn-pay">Back to activities</a>
      </div>
      </div>
    </main>
  `,
  styles: [
    `
      .payment-page {
        max-width: 760px;
        margin: 0 auto;
        padding: 80px 20px 48px;
      }
      .payment-inner {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .payment-head { text-align: center; }
      .kicker {
        margin: 0 0 8px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .title {
        margin: 0;
        font-size: clamp(1.25rem, 3vw, 1.7rem);
        font-weight: 800;
      }
      .accent { color: var(--tunisia-red); }
      .sub { font-size: 0.85em; color: var(--text-muted); font-weight: 600; }
      .state-card {
        padding: 2.1rem;
        border-radius: 18px;
        background: var(--glass-bg, rgba(255,255,255,0.08));
        border: 1px solid var(--glass-border, rgba(255,255,255,0.14));
        color: var(--text-color);
        box-shadow: 0 22px 40px rgba(15, 23, 42, 0.08);
      }
      .brand {
        margin-bottom: 1.1rem;
      }
      .brand img {
        height: 56px;
        width: auto;
        display: block;
      }
      .lead {
        margin: 0;
        color: var(--text-muted);
      }
      .ok h2 {
        margin: 0 0 0.4rem;
        color: #22c55e;
        font-size: 1.65rem;
      }
      .err h2 {
        margin: 0 0 0.75rem;
        color: #f87171;
      }
      .meta {
        margin: 1rem 0;
        padding: 1.15rem;
        border-radius: 12px;
        border: 1px solid var(--glass-border, rgba(255,255,255,0.16));
        background: rgba(255,255,255,0.03);
      }
      .meta p {
        margin: 0.35rem 0;
      }
      .qr {
        margin-top: 1rem;
        text-align: center;
      }
      .qr img {
        width: 210px;
        height: 210px;
        border-radius: 10px;
        background: #fff;
        padding: 0.5rem;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
      }
      .qr small {
        display: block;
        margin-top: 0.5rem;
        color: var(--text-muted);
      }
      .actions {
        margin-top: 1.25rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .btn,
      .btn-pay {
        display: inline-block;
        padding: 13px 16px;
        border-radius: 14px;
        background: linear-gradient(135deg, #ff4b4b, var(--tunisia-red));
        border: none;
        color: #fff;
        text-decoration: none;
        font-weight: 700;
        cursor: pointer;
      }
      .btn.secondary {
        background: rgba(51, 65, 85, 0.9);
      }
      .animate-in { animation: fadeIn .35s ease both; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }

      .btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ActivityPaymentSuccessComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  status: 'loading' | 'ok' | 'error' = 'loading';
  message = '';
  reservation: ActivityReservationResponse | null = null;
  qrObjectUrl: string | null = null;
  downloadingPdf = false;

  ngOnInit(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      this.status = 'error';
      this.message = 'Missing payment session. Please retry your booking.';
      return;
    }

    this.http.post<ActivityReservationResponse>('/api/public/activity-reservations/finalize-checkout', { sessionId }).subscribe({
      next: (res: ActivityReservationResponse) => {
        this.reservation = res;
        this.status = 'ok';
        this.loadQrReceipt();
      },
      error: (err: HttpErrorResponse) => {
        this.status = 'error';
        this.message = extractApiErrorMessage(err, 'Could not confirm activity payment.');
      },
    });
  }

  ngOnDestroy(): void {
    this.revokeQrUrl();
  }

  private loadQrReceipt(): void {
    if (!this.reservation) {
      return;
    }

    this.http.get(`/api/public/activity-reservations/${this.reservation.reservationId}/qr`, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        this.revokeQrUrl();
        this.qrObjectUrl = URL.createObjectURL(blob);
      },
      error: () => {
        this.qrObjectUrl = null;
      },
    });
  }

  downloadPdf(): void {
    if (!this.reservation || this.downloadingPdf) {
      return;
    }

    this.downloadingPdf = true;
    this.http.get(`/api/public/activity-reservations/${this.reservation.reservationId}/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        this.downloadingPdf = false;
        const objectUrl = URL.createObjectURL(blob);
        const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
        if (isMobile) {
          window.open(objectUrl, '_blank');
          setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
          return;
        }

        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = 'yallatn-activity-confirmation.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      },
      error: (err: HttpErrorResponse) => {
        this.downloadingPdf = false;
        this.message = extractApiErrorMessage(err, 'Unable to download PDF receipt.');
      },
    });
  }

  private revokeQrUrl(): void {
    if (this.qrObjectUrl) {
      URL.revokeObjectURL(this.qrObjectUrl);
      this.qrObjectUrl = null;
    }
  }
}
