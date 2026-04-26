import { Component, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { AmadeusCarOffer } from '../../../core/models/travel.models';

@Component({
  selector: 'app-car-rental-amadeus-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, ButtonModule, RippleModule, ProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cr">
      <a routerLink="/transport" class="cr-back">{{ 'CAR_AMADEUS.BACK_TRANSPORT' | translate }}</a>
      <h1 class="cr-title">{{ 'CAR_AMADEUS.TITLE' | translate }}</h1>
      <p class="cr-intro">{{ 'CAR_AMADEUS.INTRO' | translate }}</p>

      <div class="cr-form">
        <label class="cr-f">
          <span>{{ 'CAR_AMADEUS.FIELD_LOCATION' | translate }}</span>
          <input type="text" [(ngModel)]="location" maxlength="3" class="cr-input" [placeholder]="'CAR_AMADEUS.PLACEHOLDER_IATA' | translate" />
        </label>
        <label class="cr-f">
          <span>{{ 'CAR_AMADEUS.FIELD_START' | translate }}</span>
          <input type="date" [(ngModel)]="startDate" class="cr-input" />
        </label>
        <label class="cr-f">
          <span>{{ 'CAR_AMADEUS.FIELD_END' | translate }}</span>
          <input type="date" [(ngModel)]="endDate" class="cr-input" />
        </label>
        <label class="cr-f">
          <span>{{ 'CAR_AMADEUS.FIELD_PAX' | translate }}</span>
          <input type="number" [(ngModel)]="passengers" min="1" max="8" class="cr-input cr-input-n" />
        </label>
        <button type="button" pButton pRipple class="cr-btn" [disabled]="loading()" (click)="runSearch()">
          {{ 'CAR_AMADEUS.SEARCH' | translate }}
        </button>
      </div>

      @if (loading()) {
        <div class="cr-loading">
          <p-progressSpinner strokeWidth="4" animationDuration=".8s" />
          <span>{{ 'CAR_AMADEUS.LOADING' | translate }}</span>
        </div>
      }

      @if (errorMsg()) {
        <p class="cr-err">{{ errorMsg() }}</p>
      }

      @if (simulation()) {
        <div class="cr-sim">
          <h2>{{ 'CAR_AMADEUS.SIM_TITLE' | translate }}</h2>
          <p><strong>{{ simulation()!.confirmationRef }}</strong></p>
          <p class="cr-muted">{{ simulation()!.message }}</p>
        </div>
      }

      @if (!loading() && offers().length > 0) {
        <h2 class="cr-h2">{{ 'CAR_AMADEUS.RESULTS' | translate }}</h2>
        <ul class="cr-list">
          @for (o of offers(); track o.offerId) {
            <li class="cr-card">
              <div class="cr-card-top">
                <span class="cr-provider">{{ o.provider }}</span>
                <span class="cr-price">{{ o.price | number: '1.0-0' }} {{ o.currency }}</span>
              </div>
              <p class="cr-model">{{ o.model }}</p>
              <p class="cr-loc">{{ o.location }}</p>
              <button type="button" pButton class="p-button-outlined p-button-sm" (click)="simulate(o)">
                {{ 'CAR_AMADEUS.BTN_SIMULATE' | translate }}
              </button>
            </li>
          }
        </ul>
      } @else if (!loading() && searched() && !errorMsg() && offers().length === 0) {
        <p class="cr-empty">{{ 'CAR_AMADEUS.EMPTY' | translate }}</p>
      }
    </div>
  `,
  styles: [`
    .cr { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
    .cr-back { display: inline-block; margin-bottom: 1rem; font-size: 0.88rem; color: #f12545; text-decoration: none; font-weight: 600; }
    .cr-title { font-family: 'Outfit', sans-serif; font-size: 1.65rem; font-weight: 800; margin: 0 0 0.5rem; color: var(--text-color); }
    .cr-intro { color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.5rem; }
    .cr-form {
      display: grid; gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      align-items: end;
      margin-bottom: 2rem;
      padding: 1.25rem;
      border-radius: 16px;
      border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
      background: var(--surface-1, #111827);
    }
    .cr-f { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
    .cr-input {
      padding: 0.55rem 0.65rem; border-radius: 10px; border: 1px solid var(--glass-border);
      background: var(--input-bg); color: var(--text-color); font-size: 0.9rem;
    }
    .cr-input-n { max-width: 100%; }
    .cr-btn { grid-column: 1 / -1; justify-self: start; }
    .cr-loading { display: flex; align-items: center; gap: 1rem; color: var(--text-muted); margin: 1rem 0; }
    .cr-err { color: #f87171; font-size: 0.9rem; }
    .cr-h2 { font-size: 1.1rem; margin: 1.5rem 0 0.75rem; color: var(--text-color); }
    .cr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
    .cr-card {
      padding: 1.1rem 1.25rem; border-radius: 14px;
      border: 1px solid var(--glass-border);
      background: var(--surface-1, #111827);
    }
    .cr-card-top { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
    .cr-provider { font-weight: 700; color: var(--text-color); }
    .cr-price { font-family: 'Outfit', sans-serif; font-weight: 800; color: #f12545; font-size: 1.15rem; }
    .cr-model { margin: 0.35rem 0 0.15rem; color: var(--text-color); font-size: 0.92rem; }
    .cr-loc { margin: 0 0 0.75rem; font-size: 0.82rem; color: var(--text-muted); }
    .cr-empty { color: var(--text-muted); font-size: 0.9rem; }
    .cr-sim {
      margin-top: 1.5rem; padding: 1rem 1.25rem; border-radius: 14px;
      border: 1px solid color-mix(in srgb, #22c55e 35%, var(--glass-border));
      background: color-mix(in srgb, #22c55e 8%, var(--surface-1));
    }
    .cr-sim h2 { margin: 0 0 0.5rem; font-size: 1rem; color: var(--text-color); }
    .cr-muted { font-size: 0.82rem; color: var(--text-muted); margin: 0.5rem 0 0; }
  `],
})
export class CarRentalAmadeusPageComponent {
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);
  private readonly translate = inject(TranslateService);
  private readonly alerts = inject(AppAlertsService);
  private readonly cdr = inject(ChangeDetectorRef);

  location = 'TUN';
  startDate = '';
  endDate = '';
  passengers = 2;

  loading = signal(false);
  searched = signal(false);
  errorMsg = signal<string | null>(null);
  offers = signal<AmadeusCarOffer[]>([]);
  simulation = signal<{ confirmationRef: string; message?: string } | null>(null);

  constructor() {
    const t = new Date();
    const d0 = t.toISOString().slice(0, 10);
    const t1 = new Date(t);
    t1.setDate(t1.getDate() + 3);
    const d1 = t1.toISOString().slice(0, 10);
    this.startDate = d0;
    this.endDate = d1;
  }

  runSearch(): void {
    this.simulation.set(null);
    this.errorMsg.set(null);
    const loc = (this.location || '').trim().toUpperCase();
    if (loc.length !== 3) {
      void this.alerts.warning(
        this.translate.instant('CAR_AMADEUS.ALERT_LOC_TITLE'),
        this.translate.instant('CAR_AMADEUS.ALERT_LOC_BODY'),
      );
      return;
    }
    if (!this.startDate || !this.endDate) {
      void this.alerts.warning(
        this.translate.instant('CAR_AMADEUS.ALERT_DATE_TITLE'),
        this.translate.instant('CAR_AMADEUS.ALERT_DATE_BODY'),
      );
      return;
    }
    this.loading.set(true);
    this.searched.set(false);
    this.cdr.markForCheck();
    this.dataSource
      .searchAmadeusCars({
        location: loc,
        startDate: this.startDate,
        endDate: this.endDate,
        passengers: Math.min(8, Math.max(1, Number(this.passengers) || 1)),
      })
      .subscribe({
        next: (rows) => {
          this.offers.set(rows ?? []);
          this.loading.set(false);
          this.searched.set(true);
          this.cdr.markForCheck();
        },
        error: (e: unknown) => {
          this.loading.set(false);
          this.searched.set(true);
          const status = e instanceof HttpErrorResponse ? e.status : undefined;
          let msg = this.translate.instant('CAR_AMADEUS.ERROR_GENERIC');
          if (status === 503) {
            msg = this.translate.instant('CAR_AMADEUS.ERROR_503');
          } else if (status === 401 || status === 403) {
            msg = this.translate.instant('CAR_AMADEUS.ERROR_AUTH');
          } else if (status === 502 || status === 504) {
            msg = this.translate.instant('CAR_AMADEUS.ERROR_UPSTREAM');
          }
          this.errorMsg.set(msg);
          this.cdr.markForCheck();
        },
      });
  }

  simulate(o: AmadeusCarOffer): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.cdr.markForCheck();
    this.dataSource.simulateAmadeusCarBooking(o.offerId).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.simulation.set({ confirmationRef: r.confirmationRef, message: r.message });
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set(this.translate.instant('CAR_AMADEUS.ERROR_SIM'));
        this.cdr.markForCheck();
      },
    });
  }
}
