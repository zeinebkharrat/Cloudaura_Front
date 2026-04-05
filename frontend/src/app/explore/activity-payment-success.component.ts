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
    <main class="wrap">
      <div class="card" *ngIf="status === 'loading'">
        <p class="lead">Confirming your activity payment...</p>
      </div>

      <div class="card ok" *ngIf="status === 'ok' && reservation">
        <div class="brand">
          <img src="assets/logo/yallatn-logo.png" alt="YallaTN logo" />
        </div>
        <h1>Payment confirmed</h1>
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

      <div class="card err" *ngIf="status === 'error'">
        <h1>Could not confirm payment</h1>
        <p>{{ message }}</p>
        <a routerLink="/services/activities" class="btn">Back to activities</a>
      </div>
    </main>
  `,
  styles: [
    `
      .wrap {
        max-width: 760px;
        margin: 3rem auto;
        padding: 1.5rem;
        background:
          radial-gradient(circle at 10% 5%, rgba(0, 168, 204, 0.18), transparent 38%),
          radial-gradient(circle at 90% 95%, rgba(241, 37, 69, 0.15), transparent 34%),
          #f4f7fb;
        border-radius: 24px;
      }
      .card {
        --panel-bg: #ffffff;
        --panel-border: #dbe6f0;
        --text-main: #1f2937;
        --text-soft: #5a6d82;
        --ok: #0ea5a4;
        --error: #dc2626;
        --meta-bg: #f7fbff;
        --meta-border: #d7e5f3;
        padding: 2.1rem;
        border-radius: 18px;
        background: var(--panel-bg);
        border: 1px solid var(--panel-border);
        color: var(--text-main);
        box-shadow: 0 22px 40px rgba(15, 23, 42, 0.12);
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
        color: var(--text-soft);
      }
      .ok h1 {
        margin: 0 0 0.4rem;
        color: #0c8f95;
        font-size: 2rem;
      }
      .err h1 {
        margin: 0 0 0.75rem;
        color: var(--error);
      }
      .meta {
        margin: 1rem 0;
        padding: 1.15rem;
        border-radius: 12px;
        border: 1px solid var(--meta-border);
        background: var(--meta-bg);
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
        color: var(--text-soft);
      }
      .actions {
        margin-top: 1.25rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .btn {
        display: inline-block;
        padding: 0.65rem 1.25rem;
        border-radius: 10px;
        background: #f12545;
        border: none;
        color: #fff;
        text-decoration: none;
        font-weight: 600;
        cursor: pointer;
      }
      .btn.secondary {
        background: #334155;
      }
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
