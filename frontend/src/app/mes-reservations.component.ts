import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, of, EMPTY } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { DATA_SOURCE_TOKEN } from './core/adapters/data-source.adapter';
import { AuthService } from './core/auth.service';
import { AppAlertsService } from './core/services/app-alerts.service';
import { TripContextStore } from './core/stores/trip-context.store';
import { UserReservationsLocalStore } from './core/stores/user-reservations-local.store';
import { TrackingMapComponent } from './shared/components/tracking-map/tracking-map.component';
import { TransportReservation, AccommodationReservation } from './core/models/travel.models';

type ActiveTab = 'transport' | 'hebergement';

@Component({
  selector: 'app-mes-reservations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TrackingMapComponent],
  template: `
    <div class="mr-page">
      <div class="mr-bg-orb mr-bg-orb-left"></div>
      <div class="mr-bg-orb mr-bg-orb-right"></div>

      <div class="mr-wrap">

        <!-- Header -->
        <div class="mr-header-card">
        <div class="mr-header">
          <button type="button" class="mr-back-btn" (click)="goHome()" title="Back to home" aria-label="Back to home">
            <i class="pi pi-home"></i>
          </button>
          <div class="mr-header-text">
            <p class="mr-kicker">YallaTN</p>
            <h1 class="mr-title">
              <span class="mr-title-plain">My</span>
              <span class="mr-title-accent"> bookings</span>
            </h1>
            <p class="mr-subtitle">Transport tickets &amp; accommodation — pay, download, or track in one place</p>
          </div>
          <div class="mr-header-actions">
            <button type="button" class="mr-refresh-btn" (click)="loadReservations()" [disabled]="loading()" title="Refresh">
              <i class="pi pi-refresh" [class.mr-spin]="loading()"></i>
            </button>
            <button type="button" class="mr-new-btn" (click)="router.navigate(['/hebergement'])">
              <i class="pi pi-plus"></i> Accommodation
            </button>
            <button type="button" class="mr-new-btn mr-new-btn-red" (click)="router.navigate(['/transport'])">
              <i class="pi pi-plus"></i> Transport
            </button>
          </div>
        </div>
        </div>

        <!-- Stats Bar -->
        <div class="mr-stats">
          <div class="mr-stat">
            <span class="mr-stat-num">{{ transportReservations().length }}</span>
            <span class="mr-stat-label">Transports</span>
          </div>
          <div class="mr-stat-divider"></div>
          <div class="mr-stat">
            <span class="mr-stat-num">{{ accommodationReservations().length }}</span>
            <span class="mr-stat-label">Stays</span>
          </div>
          <div class="mr-stat-divider"></div>
          <div class="mr-stat">
            <span class="mr-stat-num">{{ totalReservations() }}</span>
            <span class="mr-stat-label">Total</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mr-tabs">
          <button type="button" class="mr-tab" [class.mr-tab-active]="activeTab() === 'transport'"
                  (click)="activeTab.set('transport')">
            <i class="pi pi-car mr-tab-pi"></i>
            Transport
            @if (transportReservations().length > 0) {
              <span class="mr-tab-badge">{{ transportReservations().length }}</span>
            }
          </button>
          <button type="button" class="mr-tab" [class.mr-tab-active]="activeTab() === 'hebergement'"
                  (click)="activeTab.set('hebergement')">
            <i class="pi pi-building mr-tab-pi"></i>
            Accommodation
            @if (accommodationReservations().length > 0) {
              <span class="mr-tab-badge">{{ accommodationReservations().length }}</span>
            }
          </button>
        </div>

        <!-- Loading -->
        @if (loading()) {
          <div class="mr-loading">
            <div class="mr-spinner"></div>
            <p>Loading your bookings…</p>
          </div>
        }

        <!-- Error -->
        @if (error()) {
          <div class="mr-error">
            <i class="pi pi-exclamation-triangle"></i>
            {{ error() }}
          </div>
        }

        <p class="mr-sync-hint">
          Bookings created on this device are kept here even when the server is unavailable (local list).
        </p>

        <!-- Transport Tab -->
        @if (!loading() && activeTab() === 'transport') {
          @if (transportReservations().length === 0) {
            <div class="mr-empty">
              <i class="pi pi-car mr-empty-pi"></i>
              <h3>No transport bookings</h3>
              <p>You have not booked transport yet.</p>
              <button class="mr-cta-btn" (click)="router.navigate(['/transport'])">
                Search transport
              </button>
            </div>
          } @else {
            <div class="mr-list">
              @for (res of transportReservations(); track res.transportReservationId) {
                <div class="mr-card mr-card-transport">
                  <div class="mr-card-accent"></div>
                  <div class="mr-card-body">
                    <div class="mr-card-top">
                      <div class="mr-route">
                        <span class="mr-city">{{ res.departureCityName || '—' }}</span>
                        <div class="mr-track">
                          <span class="mr-dot"></span>
                          <span class="mr-line"></span>
                          <span class="mr-transport-type">{{ getTransportTypeLabel(res.transportType) }}</span>
                          <span class="mr-line"></span>
                          <span class="mr-dot"></span>
                        </div>
                        <span class="mr-city mr-city-end">{{ res.arrivalCityName || '—' }}</span>
                      </div>
                      <div class="mr-card-right">
                        <span class="mr-amount">{{ res.totalPrice }} <small>TND</small></span>
                        <span class="mr-badge" [class]="'mr-badge-' + (res.status | lowercase)">
                          {{ res.status }}
                        </span>
                      </div>
                    </div>

                    <div class="mr-card-divider"></div>

                    <div class="mr-card-details">
                      <div class="mr-detail">
                        <i class="pi pi-hashtag"></i>
                        <span>{{ res.reservationRef }}</span>
                      </div>
                      @if (res.travelDate) {
                        <div class="mr-detail">
                          <i class="pi pi-calendar"></i>
                          <span>{{ formatDate(res.travelDate) }}</span>
                        </div>
                      }
                      @if (res.departureTime) {
                        <div class="mr-detail">
                          <i class="pi pi-clock"></i>
                          <span>{{ formatTime(res.departureTime) }}</span>
                        </div>
                      }
                      <div class="mr-detail">
                        <i class="pi pi-users"></i>
                        <span>{{ res.numberOfSeats }} seat(s)</span>
                      </div>
                      <div class="mr-detail">
                        <i class="pi pi-wallet"></i>
                        <span>{{ res.paymentMethod }}</span>
                      </div>
                    </div>

                    <div class="mr-passenger">
                      <i class="pi pi-user"></i>
                      {{ res.passengerFirstName }} {{ res.passengerLastName }}
                      <span class="mr-passenger-email">· {{ res.passengerEmail }}</span>
                    </div>

                    <div class="mr-card-actions">
                      @if (isTodayTrip(res.travelDate) && res.status === 'CONFIRMED') {
                        <button type="button" class="mr-action-btn mr-action-track" (click)="openTracking(res)">
                          <i class="pi pi-map"></i> Live tracking
                        </button>
                      }
                      <button type="button" class="mr-action-btn mr-action-qr" (click)="openQrLightbox(res)"
                              [disabled]="isTicketBusy(res, 'qr') || cancellingTransportId() === res.transportReservationId"
                              title="View and save boarding QR">
                        @if (isTicketBusy(res, 'qr')) {
                          <span class="mr-mini-spin" aria-hidden="true"></span>
                        } @else {
                          <i class="pi pi-qrcode" aria-hidden="true"></i>
                        }
                        QR
                      </button>
                      <button type="button" class="mr-action-btn mr-action-pdf" (click)="downloadPdfTicket(res)"
                              [disabled]="isTicketBusy(res, 'pdf') || cancellingTransportId() === res.transportReservationId"
                              title="Open or download PDF ticket">
                        @if (isTicketBusy(res, 'pdf')) {
                          <span class="mr-mini-spin" aria-hidden="true"></span>
                        } @else {
                          <i class="pi pi-file-pdf" aria-hidden="true"></i>
                        }
                        PDF
                      </button>
                      <button type="button" class="mr-action-btn mr-action-outline" (click)="goModifyTransport(res)"
                              [disabled]="cancellingTransportId() === res.transportReservationId || res.status === 'CANCELLED'"
                              [attr.title]="res.status === 'CANCELLED' ? 'Cancelled — book a new trip from Transport' : 'Open this trip to adjust seats or details'">
                        <i class="pi pi-pencil" aria-hidden="true"></i> Edit
                      </button>
                      <button type="button" class="mr-action-btn mr-action-danger" (click)="cancelTransport(res)"
                              [disabled]="cancellingTransportId() === res.transportReservationId">
                        @if (cancellingTransportId() === res.transportReservationId) {
                          <span class="mr-mini-spin"></span>
                        } @else {
                          <i class="pi pi-times"></i>
                        }
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- Hebergement Tab -->
        @if (!loading() && activeTab() === 'hebergement') {
          @if (accommodationReservations().length === 0) {
            <div class="mr-empty">
              <i class="pi pi-building mr-empty-pi"></i>
              <h3>No accommodation bookings</h3>
              <p>You have not booked accommodation yet.</p>
              <button class="mr-cta-btn" (click)="router.navigate(['/hebergement'])">
                Find accommodation
              </button>
            </div>
          } @else {
            <div class="mr-list">
              @for (res of accommodationReservations(); track res.id) {
                <div class="mr-card mr-card-heb">
                  <div class="mr-card-accent mr-card-accent-heb"></div>
                  <div class="mr-card-body">
                    <div class="mr-card-top">
                      <div class="mr-heb-info">
                        <span class="mr-heb-name">{{ res.accommodationName || 'Accommodation' }}</span>
                        @if (res.accommodationCity) {
                          <span class="mr-heb-city"><i class="pi pi-map-marker"></i> {{ res.accommodationCity }}</span>
                        }
                      </div>
                      <div class="mr-card-right">
                        <span class="mr-amount">{{ res.totalPrice }} <small>TND</small></span>
                        <span class="mr-badge" [class]="'mr-badge-' + (res.status | lowercase)">
                          {{ res.status }}
                        </span>
                      </div>
                    </div>

                    <div class="mr-card-divider"></div>

                    <div class="mr-card-details">
                      @if (res.reservationRef) {
                        <div class="mr-detail">
                          <i class="pi pi-hashtag"></i>
                          <span>{{ res.reservationRef }}</span>
                        </div>
                      }
                      @if (res.checkInDate) {
                        <div class="mr-detail">
                          <i class="pi pi-sign-in"></i>
                          <span>Check-in: {{ formatDate(res.checkInDate) }}</span>
                        </div>
                      }
                      @if (res.checkOutDate) {
                        <div class="mr-detail">
                          <i class="pi pi-sign-out"></i>
                          <span>Check-out: {{ formatDate(res.checkOutDate) }}</span>
                        </div>
                      }
                      @if (res.nights) {
                        <div class="mr-detail">
                          <i class="pi pi-moon"></i>
                          <span>{{ res.nights }} night(s)</span>
                        </div>
                      }
                      @if (res.roomType) {
                        <div class="mr-detail">
                          <i class="pi pi-home"></i>
                          <span>{{ res.roomType }}</span>
                        </div>
                      }
                      @if (res.paymentMethod) {
                        <div class="mr-detail">
                          <i class="pi pi-wallet"></i>
                          <span>{{ res.paymentMethod }}</span>
                        </div>
                      }
                    </div>

                    @if (res.guestFirstName) {
                      <div class="mr-passenger">
                        <i class="pi pi-user"></i>
                        {{ res.guestFirstName }} {{ res.guestLastName }}
                        @if (res.guestEmail) {
                          <span class="mr-passenger-email">· {{ res.guestEmail }}</span>
                        }
                      </div>
                    }

                    <div class="mr-card-actions">
                      <button type="button" class="mr-action-btn mr-action-outline" (click)="goModifyHebergement()"
                              [disabled]="cancellingHebergementId() === res.id">
                        <i class="pi pi-pencil"></i> Edit
                      </button>
                      <button type="button" class="mr-action-btn mr-action-danger" (click)="cancelHebergement(res)"
                              [disabled]="cancellingHebergementId() === res.id">
                        @if (cancellingHebergementId() === res.id) {
                          <span class="mr-mini-spin"></span>
                        } @else {
                          <i class="pi pi-times"></i>
                        }
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }

      </div>

      <!-- QR preview -->
      @if (qrLightbox(); as ql) {
        <div class="mr-qr-overlay" (click)="closeQrLightbox()" role="dialog" aria-modal="true" aria-labelledby="mr-qr-title">
          <div class="mr-qr-dialog" (click)="$event.stopPropagation()">
            <div class="mr-qr-dialog-head">
              <h3 id="mr-qr-title"><i class="pi pi-qrcode" aria-hidden="true"></i> Boarding QR</h3>
              <button type="button" class="mr-qr-close" (click)="closeQrLightbox()" aria-label="Close">
                <i class="pi pi-times"></i>
              </button>
            </div>
            <p class="mr-qr-ref"><i class="pi pi-hashtag" aria-hidden="true"></i> {{ ql.ref }}</p>
            <div class="mr-qr-img-wrap">
              <img [src]="ql.blobUrl" width="280" height="280" alt="QR code for ticket {{ ql.ref }}" />
            </div>
            <p class="mr-qr-hint">Show this code at boarding. You can save the image to your phone.</p>
            <div class="mr-qr-dialog-actions">
              <button type="button" class="mr-qr-btn-primary" (click)="downloadCurrentQr()">
                <i class="pi pi-download" aria-hidden="true"></i> Save PNG
              </button>
              <button type="button" class="mr-qr-btn-ghost" (click)="closeQrLightbox()">Close</button>
            </div>
          </div>
        </div>
      }

      <!-- Tracking Dialog Overlay -->
      @if (trackingReservation()) {
        <div class="tracking-overlay" (click)="closeTracking()">
          <div class="tracking-dialog" (click)="$event.stopPropagation()">
            <div class="tracking-dialog-header">
              <h3>
                <i class="pi pi-map"></i>
                Live tracking: {{ trackingReservation()!.departureCityName }} → {{ trackingReservation()!.arrivalCityName }}
              </h3>
              <button class="tracking-close" (click)="closeTracking()">
                <i class="pi pi-times"></i>
              </button>
            </div>
            <app-tracking-map
              [reservationId]="trackingReservation()!.transportReservationId"
              [fromName]="trackingReservation()!.departureCityName ?? ''"
              [toName]="trackingReservation()!.arrivalCityName ?? ''">
            </app-tracking-map>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .mr-page {
      min-height: 100vh;
      padding: 100px 1.5rem 4rem;
      position: relative;
      overflow: hidden;
    }

    .mr-bg-orb {
      position: absolute;
      width: 400px; height: 400px;
      border-radius: 50%;
      filter: blur(90px);
      opacity: 0.25;
      pointer-events: none;
    }
    .mr-bg-orb-left { left: -100px; top: 10%; background: rgba(241,37,69,0.5); }
    .mr-bg-orb-right { right: -80px; bottom: 15%; background: rgba(0,119,182,0.5); }

    .mr-wrap {
      max-width: 900px;
      margin: 0 auto;
      position: relative; z-index: 2;
    }

    .mr-header-card {
      background: linear-gradient(145deg, rgba(22,25,34,0.95) 0%, rgba(15,18,28,0.98) 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 22px;
      padding: 1.35rem 1.5rem 1.5rem;
      margin-bottom: 1.75rem;
      box-shadow: 0 20px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(241,37,69,0.06);
    }

    /* Header */
    .mr-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .mr-kicker {
      margin: 0 0 0.25rem;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #f12545;
    }
    .mr-title-plain { color: var(--text-color); }
    .mr-title-accent {
      background: linear-gradient(135deg, #f12545, #ff8a9b);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .mr-back-btn {
      width: 40px; height: 40px;
      border-radius: 50%;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.04);
      color: var(--text-color);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .mr-back-btn:hover { background: rgba(241,37,69,0.1); border-color: rgba(241,37,69,0.3); }
    .mr-header-text { flex: 1; }
    .mr-title {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(1.45rem, 4vw, 1.85rem);
      font-weight: 800;
      margin: 0;
      line-height: 1.15;
    }
    .mr-subtitle { font-size: 0.88rem; color: var(--text-muted); margin: 0.45rem 0 0; max-width: 36rem; line-height: 1.45; }
    .mr-header-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
    .mr-new-btn {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 1.1rem; border-radius: 50px;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.04);
      color: var(--text-color); cursor: pointer;
      font-size: 0.82rem; font-weight: 600;
      transition: all 0.2s;
    }
    .mr-new-btn:hover { background: rgba(255,255,255,0.08); }
    .mr-new-btn-red {
      background: linear-gradient(135deg, #f12545, #c41230);
      color: #fff; border-color: transparent;
      box-shadow: 0 4px 14px rgba(241,37,69,0.25);
    }
    .mr-new-btn-red:hover { box-shadow: 0 6px 20px rgba(241,37,69,0.35); }

    .mr-refresh-btn {
      width: 40px; height: 40px; border-radius: 50%;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.04);
      color: var(--text-color);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .mr-refresh-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .mr-refresh-btn:hover:not(:disabled) { border-color: rgba(241,37,69,0.35); }
    .mr-spin { animation: mrspin 0.8s linear infinite; }
    @keyframes mrspin { to { transform: rotate(360deg); } }

    .mr-sync-hint {
      font-size: 0.78rem; color: var(--text-muted);
      margin: 0 0 1rem; line-height: 1.45;
      padding: 0.65rem 0.9rem;
      border-radius: 10px;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.02);
    }

    /* Stats */
    .mr-stats {
      display: flex; align-items: center;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--glass-border);
      border-radius: 16px; padding: 1rem 1.5rem;
      margin-bottom: 1.75rem; gap: 1.5rem;
    }
    .mr-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .mr-stat-num {
      font-family: 'Outfit', sans-serif;
      font-size: 1.7rem; font-weight: 800; color: #f12545; line-height: 1;
    }
    .mr-stat-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .mr-stat-divider { width: 1px; height: 36px; background: var(--glass-border); }

    /* Tabs */
    .mr-tabs {
      display: flex; gap: 0.5rem;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--glass-border);
      border-radius: 14px; padding: 0.4rem;
      margin-bottom: 1.5rem;
    }
    .mr-tab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.75rem 1rem; border-radius: 10px;
      border: none; cursor: pointer;
      background: transparent; color: var(--text-muted);
      font-size: 0.9rem; font-weight: 600;
      transition: all 0.25s;
    }
    .mr-tab:hover { color: var(--text-color); }
    .mr-tab-active {
      background: linear-gradient(135deg, rgba(241,37,69,0.15), rgba(241,37,69,0.05));
      border: 1px solid rgba(241,37,69,0.2);
      color: #f12545;
    }
    .mr-tab-pi { font-size: 0.95rem; color: #f12545; }
    .mr-tab-badge {
      background: #f12545; color: #fff;
      border-radius: 50px; padding: 1px 7px;
      font-size: 0.72rem; font-weight: 800;
      min-width: 20px; text-align: center;
    }

    /* Loading */
    .mr-loading {
      text-align: center; padding: 4rem 2rem;
      color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem;
    }
    .mr-spinner {
      width: 40px; height: 40px; border-radius: 50%;
      border: 3px solid var(--glass-border);
      border-top-color: #f12545;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Error */
    .mr-error {
      padding: 1rem 1.25rem; border-radius: 12px;
      background: rgba(241,37,69,0.08); border: 1px solid rgba(241,37,69,0.2);
      color: #f12545; font-size: 0.88rem;
      display: flex; align-items: center; gap: 0.5rem;
    }

    /* Empty */
    .mr-empty {
      text-align: center; padding: 4rem 2rem;
      border: 1px dashed var(--glass-border);
      border-radius: 20px;
      background: rgba(255,255,255,0.01);
    }
    .mr-empty-pi { font-size: 3rem; margin-bottom: 1rem; display: block; color: var(--text-muted); opacity: 0.45; }
    .mr-empty h3 { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem; color: var(--text-color); }
    .mr-empty p { font-size: 0.88rem; color: var(--text-muted); margin: 0 0 1.5rem; }
    .mr-cta-btn {
      padding: 0.75rem 1.75rem; border-radius: 50px;
      background: linear-gradient(135deg, #f12545, #c41230);
      color: #fff; font-weight: 700; font-size: 0.92rem;
      border: none; cursor: pointer;
      box-shadow: 0 6px 20px rgba(241,37,69,0.28);
      transition: all 0.2s;
    }
    .mr-cta-btn:hover { box-shadow: 0 8px 28px rgba(241,37,69,0.38); transform: translateY(-1px); }

    /* Cards */
    .mr-list { display: flex; flex-direction: column; gap: 1rem; }
    .mr-card {
      border-radius: 18px;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.02);
      overflow: hidden;
      display: flex;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .mr-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.15); }

    .mr-card-accent {
      width: 4px; flex-shrink: 0;
      background: linear-gradient(180deg, #f12545, #ff6b6b);
    }
    .mr-card-accent-heb {
      background: linear-gradient(180deg, #0077b6, #48cae4);
    }

    .mr-card-body { flex: 1; padding: 1.25rem 1.5rem; }

    .mr-card-top {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
    }

    /* Transport route */
    .mr-route { display: flex; align-items: center; gap: 0.5rem; flex: 1; }
    .mr-city { font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; color: var(--text-color); }
    .mr-city-end { text-align: right; }
    .mr-track { flex: 1; display: flex; align-items: center; }
    .mr-dot { width: 7px; height: 7px; border-radius: 50%; background: #f12545; flex-shrink: 0; }
    .mr-line { flex: 1; height: 2px; background: rgba(241,37,69,0.15); }
    .mr-transport-type {
      font-size: 0.72rem; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.4px; color: #f12545; margin: 0 0.25rem; flex-shrink: 0;
      white-space: nowrap;
    }

    /* Hebergement name */
    .mr-heb-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .mr-heb-name { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; color: var(--text-color); }
    .mr-heb-city { font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.25rem; }

    /* Right side */
    .mr-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; flex-shrink: 0; }
    .mr-amount {
      font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800; color: #f12545;
    }
    .mr-amount small { font-size: 0.65rem; opacity: 0.7; }

    /* Badges */
    .mr-badge {
      padding: 2px 10px; border-radius: 50px;
      font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .mr-badge-pending { background: rgba(234,179,8,0.15); color: #ca8a04; border: 1px solid rgba(234,179,8,0.25); }
    .mr-badge-confirmed { background: rgba(34,197,94,0.12); color: #16a34a; border: 1px solid rgba(34,197,94,0.2); }
    .mr-badge-cancelled { background: rgba(239,68,68,0.1); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }

    /* Divider */
    .mr-card-divider { height: 1px; background: var(--glass-border); margin: 0.9rem 0; }

    /* Details grid */
    .mr-card-details { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; }
    .mr-detail {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.82rem; color: var(--text-muted);
    }
    .mr-detail i { font-size: 0.8rem; color: #f12545; }

    /* Passenger */
    .mr-passenger {
      margin-top: 0.75rem;
      font-size: 0.82rem; color: var(--text-muted);
      display: flex; align-items: center; gap: 0.4rem;
    }
    .mr-passenger i { color: #f12545; }
    .mr-passenger-email { opacity: 0.7; }

    .mr-card-actions {
      display: flex; flex-wrap: wrap; gap: 0.5rem;
      margin-top: 1rem; padding-top: 0.85rem;
      border-top: 1px dashed var(--glass-border);
    }
    .mr-action-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.45rem 0.9rem; border-radius: 50px;
      font-size: 0.8rem; font-weight: 700; cursor: pointer;
      border: none; transition: all 0.2s;
    }
    .mr-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .mr-action-outline {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--glass-border);
      color: var(--text-color);
    }
    .mr-action-outline:hover:not(:disabled) { border-color: rgba(241,37,69,0.35); }
    .mr-action-danger {
      background: rgba(241,37,69,0.12);
      border: 1px solid rgba(241,37,69,0.35);
      color: #f12545;
    }
    .mr-action-danger:hover:not(:disabled) { background: rgba(241,37,69,0.2); }
    .mr-mini-spin {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(241,37,69,0.25);
      border-top-color: #f12545;
      animation: mrspin 0.7s linear infinite;
      display: inline-block;
    }

    .mr-action-track {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #fff; border: none;
      box-shadow: 0 3px 10px rgba(34,197,94,0.25);
    }
    .mr-action-track:hover { box-shadow: 0 5px 14px rgba(34,197,94,0.35); }
    .mr-action-qr {
      background: rgba(0,119,182,0.12);
      border: 1px solid rgba(0,119,182,0.25);
      color: #0077b6;
    }
    .mr-action-qr:hover { background: rgba(0,119,182,0.2); }
    .mr-action-pdf {
      background: rgba(241,37,69,0.08);
      border: 1px solid rgba(241,37,69,0.2);
      color: #f12545;
    }
    .mr-action-pdf:hover { background: rgba(241,37,69,0.15); }

    /* QR lightbox */
    .mr-qr-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.78); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 1.25rem;
      animation: fadeIn 0.2s ease;
    }
    .mr-qr-dialog {
      width: 100%; max-width: 380px;
      background: linear-gradient(165deg, #1a1d2e 0%, #12151f 100%);
      border: 1px solid rgba(241,37,69,0.22);
      border-radius: 22px;
      padding: 1.25rem 1.35rem 1.5rem;
      box-shadow: 0 28px 80px rgba(0,0,0,0.55);
    }
    .mr-qr-dialog-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .mr-qr-dialog-head h3 {
      margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-color);
      display: flex; align-items: center; gap: 0.45rem;
    }
    .mr-qr-dialog-head h3 i { color: #0077b6; }
    .mr-qr-close {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.04);
      color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .mr-qr-close:hover { color: #f12545; border-color: rgba(241,37,69,0.35); }
    .mr-qr-ref {
      font-size: 0.82rem; color: rgba(255,255,255,0.55);
      margin: 0 0 1rem;
      display: flex; align-items: center; gap: 0.35rem;
    }
    .mr-qr-img-wrap {
      display: flex; justify-content: center;
      padding: 0.75rem;
      background: #fff;
      border-radius: 16px;
      margin-bottom: 0.85rem;
    }
    .mr-qr-img-wrap img {
      display: block; width: 100%; max-width: 280px; height: auto;
      image-rendering: pixelated;
    }
    .mr-qr-hint {
      font-size: 0.78rem; color: var(--text-muted);
      line-height: 1.45; margin: 0 0 1rem; text-align: center;
    }
    .mr-qr-dialog-actions {
      display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center;
    }
    .mr-qr-btn-primary {
      flex: 1; min-width: 140px;
      display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
      padding: 0.65rem 1.2rem; border-radius: 50px;
      border: none; cursor: pointer; font-weight: 700; font-size: 0.85rem;
      background: linear-gradient(135deg, #0077b6, #005f8f);
      color: #fff;
      box-shadow: 0 4px 14px rgba(0,119,182,0.35);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .mr-qr-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,119,182,0.45); }
    .mr-qr-btn-ghost {
      padding: 0.65rem 1.2rem; border-radius: 50px;
      border: 1px solid var(--glass-border);
      background: transparent;
      color: var(--text-muted); font-weight: 600; font-size: 0.85rem;
      cursor: pointer;
    }
    .mr-qr-btn-ghost:hover { color: var(--text-color); border-color: rgba(255,255,255,0.2); }

    /* Tracking overlay */
    .tracking-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 2rem;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .tracking-dialog {
      width: 100%; max-width: 700px;
      background: var(--surface-1, #111827);
      border: 1px solid var(--glass-border);
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 24px 60px rgba(0,0,0,0.4);
    }
    .tracking-dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--glass-border);
    }
    .tracking-dialog-header h3 {
      font-size: 0.95rem; font-weight: 700; color: var(--text-color);
      margin: 0; display: flex; align-items: center; gap: 0.5rem;
    }
    .tracking-dialog-header h3 i { color: #22c55e; }
    .tracking-close {
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,0.06); border: 1px solid var(--glass-border);
      color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .tracking-close:hover { background: rgba(241,37,69,0.1); color: #f12545; }

    @media (max-width: 600px) {
      .mr-stats { flex-direction: column; gap: 0.75rem; }
      .mr-stat-divider { display: none; }
      .mr-header { flex-direction: column; align-items: flex-start; }
      .mr-route { flex-direction: column; gap: 0.3rem; }
      .mr-track { display: none; }
      .tracking-overlay { padding: 1rem; }
    }
  `]
})
export class MesReservationsComponent implements OnInit {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private dataSource = inject(DATA_SOURCE_TOKEN);
  private authService = inject(AuthService);
  private alerts = inject(AppAlertsService);
  private tripStore = inject(TripContextStore);
  private localStore = inject(UserReservationsLocalStore);

  /** QR modal: blob URL + ref for filename */
  qrLightbox = signal<{ blobUrl: string; ref: string } | null>(null);
  /** Per-ticket download in progress */
  ticketBusy = signal<{ id: number; kind: 'qr' | 'pdf' } | null>(null);

  activeTab = signal<ActiveTab>('transport');
  loading = signal(true);
  error = signal<string | null>(null);
  transportReservations = signal<TransportReservation[]>([]);
  accommodationReservations = signal<AccommodationReservation[]>([]);
  cancellingTransportId = signal<number | null>(null);
  cancellingHebergementId = signal<number | null>(null);
  trackingReservation = signal<TransportReservation | null>(null);

  totalReservations = () => this.transportReservations().length + this.accommodationReservations().length;

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'transport' || tab === 'hebergement') {
      this.activeTab.set(tab);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
    this.loadReservations();
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  loadReservations() {
    this.loading.set(true);
    this.error.set(null);
    const userId = this.authService.currentUser()?.id;
    const accommodation$ =
      userId != null
        ? this.dataSource.getMyAccommodationReservations(userId).pipe(
            catchError(() => of([] as AccommodationReservation[]))
          )
        : of([] as AccommodationReservation[]);
    const transport$ =
      userId != null
        ? this.dataSource.getMyTransportReservations(userId).pipe(
            catchError(() => of([] as TransportReservation[]))
          )
        : of([] as TransportReservation[]);

    forkJoin({
      transport: transport$,
      accommodation: accommodation$,
    }).subscribe({
      next: ({ transport, accommodation }) => {
        this.transportReservations.set(this.localStore.mergeTransport(transport));
        this.accommodationReservations.set(this.localStore.mergeAccommodation(accommodation));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your bookings.');
        this.loading.set(false);
      }
    });
  }

  isTicketBusy(res: TransportReservation, kind: 'qr' | 'pdf'): boolean {
    const b = this.ticketBusy();
    return b !== null && b.id === res.transportReservationId && b.kind === kind;
  }

  cancelTransport(res: TransportReservation) {
    void this.alerts
      .confirm({
        title: 'Cancel this transport booking?',
        text: `Reference ${res.reservationRef}. You may not be able to undo this close to departure.`,
        confirmText: 'Yes, cancel',
        cancelText: 'Keep booking',
        icon: 'warning',
      })
      .then((choice) => {
        if (!choice.isConfirmed) return;
        const uid = this.authService.currentUser()?.id;
        if (uid == null) return;
        this.cancellingTransportId.set(res.transportReservationId);
        this.dataSource
          .cancelTransportReservation(res.transportReservationId, uid)
          .pipe(
            catchError(() => {
              void this.alerts.error(
                'Cancellation failed',
                'We could not cancel this booking. Try again or contact support.'
              );
              return EMPTY;
            }),
            finalize(() => this.cancellingTransportId.set(null))
          )
          .subscribe(() => {
            this.localStore.removeTransport(res.transportReservationId);
            void this.alerts.success('Booking cancelled', 'The list has been updated.');
            this.loadReservations();
          });
      });
  }

  cancelHebergement(res: AccommodationReservation) {
    this.cancellingHebergementId.set(res.id);
    if (res.id < 0) {
      this.localStore.removeAccommodation(res.id);
      this.cancellingHebergementId.set(null);
      this.loadReservations();
      return;
    }
    const uid = this.authService.currentUser()?.id;
    if (uid == null) {
      this.cancellingHebergementId.set(null);
      return;
    }
    this.dataSource
      .cancelAccommodationReservation(res.id, uid)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const body = err?.error;
          const msg =
            (typeof body?.message === 'string' && body.message.trim()) ||
            (typeof body === 'string' ? body : null) ||
            'Could not cancel this accommodation booking right now.';
          this.error.set(msg);
          return EMPTY;
        }),
        finalize(() => this.cancellingHebergementId.set(null))
      )
      .subscribe(() => {
        this.localStore.removeAccommodation(res.id);
        this.loadReservations();
      });
  }

  goModifyTransport(res: TransportReservation) {
    if (res.status === 'CANCELLED') {
      void this.alerts.info('Cancelled trip', 'Search for a new ride from the Transport page.');
      this.router.navigate(['/transport']);
      return;
    }
    const tid = res.transportId;
    if (tid == null || !Number.isFinite(tid)) {
      void this.alerts.warning(
        'Trip link unavailable',
        'This older booking has no trip id. Use Transport search to book again.'
      );
      this.router.navigate(['/transport']);
      return;
    }
    this.tripStore.selectedTransport.set(null);
    this.router.navigate(['/transport', tid, 'book']);
  }

  goModifyHebergement() {
    this.router.navigate(['/hebergement']);
  }

  isTodayTrip(travelDate?: string): boolean {
    if (!travelDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return travelDate.slice(0, 10) === today;
  }

  openTracking(res: TransportReservation): void {
    this.trackingReservation.set(res);
  }

  closeTracking(): void {
    const res = this.trackingReservation();
    if (res) {
      this.http.post(`/api/tracking/${res.transportReservationId}/stop`, {}).subscribe();
    }
    this.trackingReservation.set(null);
  }

  openQrLightbox(res: TransportReservation): void {
    this.ticketBusy.set({ id: res.transportReservationId, kind: 'qr' });
    this.http.get(`/api/tickets/${res.transportReservationId}/qr`, { responseType: 'blob' }).pipe(
      finalize(() => this.ticketBusy.set(null))
    ).subscribe({
      next: async (blob) => {
        if (blob.type?.includes('json')) {
          void this.alerts.error('QR code', await this.messageFromErrorBlob(blob));
          return;
        }
        if (!blob?.size) {
          void this.alerts.error('QR code', 'Empty response from server.');
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        this.qrLightbox.set({ blobUrl, ref: res.reservationRef });
      },
      error: () => {
        void this.alerts.error(
          'QR code',
          'Could not load the QR code. Sign in again if the problem continues.'
        );
      },
    });
  }

  closeQrLightbox(): void {
    const q = this.qrLightbox();
    if (q?.blobUrl) {
      URL.revokeObjectURL(q.blobUrl);
    }
    this.qrLightbox.set(null);
  }

  downloadCurrentQr(): void {
    const q = this.qrLightbox();
    if (!q) return;
    const a = document.createElement('a');
    a.href = q.blobUrl;
    a.download = `ticket-${q.ref}-qr.png`;
    a.click();
    void this.alerts.success('Download', 'Saving QR image…');
  }

  downloadPdfTicket(res: TransportReservation): void {
    this.ticketBusy.set({ id: res.transportReservationId, kind: 'pdf' });
    this.http.get(`/api/tickets/${res.transportReservationId}/pdf`, { responseType: 'blob' }).pipe(
      finalize(() => this.ticketBusy.set(null))
    ).subscribe({
      next: async (blob) => {
        if (blob.type?.includes('json')) {
          void this.alerts.error('PDF ticket', await this.messageFromErrorBlob(blob));
          return;
        }
        if (!blob?.size) {
          void this.alerts.error('PDF ticket', 'Empty response from server.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const newTab = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newTab) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `billet-${res.reservationRef}.pdf`;
          a.rel = 'noopener';
          a.click();
        }
        void this.alerts.success(
          'PDF ticket',
          newTab
            ? 'Opened in a new tab — you can print or save from the viewer.'
            : 'Download started — check your downloads folder.'
        );
        window.setTimeout(() => URL.revokeObjectURL(url), 180_000);
      },
      error: () => {
        void this.alerts.error('PDF ticket', 'Could not generate the PDF. Try again in a moment.');
      },
    });
  }

  private async messageFromErrorBlob(blob: Blob): Promise<string> {
    try {
      const text = await blob.text();
      const j = JSON.parse(text) as { message?: string };
      return (j.message ?? text) || 'Request failed';
    } catch {
      return 'Request failed';
    }
  }

  getTransportTypeLabel(type?: string): string {
    const map: Record<string, string> = {
      BUS: 'Bus',
      VAN: 'Shared taxi (louage)',
      TAXI: 'Taxi',
      CAR: 'Car',
      PLANE: 'Plane',
      TRAIN: 'Train',
      FERRY: 'Ferry',
    };
    return type ? (map[type] ?? type) : 'Transport';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}
