import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { createCurrencyDisplaySyncEffect } from '../../../core/utils/currency-display-sync';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { AuthService } from '../../../core/auth.service';
import { City, TransportEstimateResult, TransportType } from '../../../core/models/travel.models';

function isEstimateOnlyType(t: string | undefined | null): t is 'TAXI' | 'BUS' {
  const u = (t ?? '').toString().toUpperCase();
  return u === 'TAXI' || u === 'BUS';
}

@Component({
  selector: 'app-transport-estimate-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ep">
      <div class="ep-shell">
        <header class="ep-header">
          <div class="ep-header-top">
            <button type="button" class="ep-back" pRipple (click)="goBack()">
              <i class="pi pi-arrow-left"></i>
              <span>{{ 'TRANSPORT_ESTIMATE.BACK' | translate }}</span>
            </button>
          </div>
          <div class="ep-header-main">
            <span class="ep-badge">{{ 'TRANSPORT_ESTIMATE.KICKER' | translate }}</span>
            <h1 class="ep-title">{{ 'TRANSPORT_ESTIMATE.TITLE' | translate }}</h1>
            <p class="ep-sub">{{ 'TRANSPORT_ESTIMATE.SUBTITLE' | translate }}</p>
          </div>
        </header>

        @if (!missingQuery() && !invalidType()) {
          <section class="ep-summary-card" [attr.aria-label]="'TRANSPORT_ESTIMATE.SUMMARY_ARIA' | translate">
            <div class="ep-route">
              <i class="pi pi-map-marker ep-route-pin" aria-hidden="true"></i>
              <div class="ep-route-text">
                <span class="ep-city">{{ departureName() }}</span>
                <span class="ep-arrow" aria-hidden="true">→</span>
                <span class="ep-city">{{ arrivalName() }}</span>
              </div>
            </div>
            <div class="ep-meta">
              <span class="ep-meta-chip"><i class="pi pi-calendar"></i> {{ dateLabel() }}</span>
              <span class="ep-meta-chip"><i class="pi pi-users"></i> {{ 'TRANSPORT_RESULTS.BADGE_PASSENGERS' | translate: { n: seats() } }}</span>
              <p-tag
                [value]="('TRANSPORT.TYPE.' + transportType()) | translate"
                severity="danger"
                styleClass="ep-tag-type" />
            </div>
          </section>
        }

      <section class="ep-body">
        @if (missingQuery()) {
          <div class="ep-state ep-state--warn">
            <div class="ep-state-icon" aria-hidden="true"><i class="pi pi-search"></i></div>
            <h2 class="ep-state-title">{{ 'TRANSPORT_ESTIMATE.STATE_MISSING_TITLE' | translate }}</h2>
            <p class="ep-state-text">{{ 'TRANSPORT_ESTIMATE.MISSING_PARAMS' | translate }}</p>
            <button pButton type="button" [label]="'TRANSPORT_ESTIMATE.GO_TRANSPORT' | translate" (click)="goTransportHome()"></button>
          </div>
        } @else if (invalidType()) {
          <div class="ep-state ep-state--warn">
            <div class="ep-state-icon" aria-hidden="true"><i class="pi pi-times-circle"></i></div>
            <h2 class="ep-state-title">{{ 'TRANSPORT_ESTIMATE.STATE_INVALID_TITLE' | translate }}</h2>
            <p class="ep-state-text">{{ 'TRANSPORT_ESTIMATE.INVALID_TYPE' | translate }}</p>
            <button pButton type="button" [label]="'TRANSPORT_ESTIMATE.GO_TRANSPORT' | translate" (click)="goTransportHome()"></button>
          </div>
        } @else if (taxiNeedsRoute()) {
          <div class="ep-state ep-state--route">
            <div class="ep-state-icon" aria-hidden="true"><i class="pi pi-map"></i></div>
            <h2 class="ep-state-title">{{ 'TRANSPORT_ESTIMATE.STATE_TAXI_TITLE' | translate }}</h2>
            <p class="ep-state-text">{{ 'TRANSPORT_ESTIMATE.TAXI_ROUTE_REQUIRED' | translate }}</p>
            <button pButton type="button" [label]="'TRANSPORT_ESTIMATE.BACK_TO_SEARCH' | translate" (click)="goTransportHome()"></button>
          </div>
        } @else if (loading()) {
          <div class="ep-skeleton-card" aria-busy="true">
            <p-skeleton width="55%" height="1.35rem" borderRadius="10px" styleClass="ep-sk" />
            <p-skeleton width="100%" height="5.5rem" borderRadius="16px" styleClass="ep-sk ep-sk-hero" />
            <p-skeleton width="100%" height="3.5rem" borderRadius="12px" styleClass="ep-sk" />
            <p-skeleton width="85%" height="0.9rem" borderRadius="6px" styleClass="ep-sk" />
            <p-skeleton width="70%" height="0.9rem" borderRadius="6px" styleClass="ep-sk" />
            <span class="ep-skeleton-hint">{{ 'TRANSPORT_ESTIMATE.LOADING' | translate }}</span>
          </div>
        } @else if (errorMessage()) {
          <div class="ep-state ep-state--error">
            <div class="ep-state-icon" aria-hidden="true"><i class="pi pi-wifi"></i></div>
            <h2 class="ep-state-title">{{ 'TRANSPORT_ESTIMATE.STATE_ERROR_TITLE' | translate }}</h2>
            <p class="ep-state-text">{{ errorMessage() }}</p>
            <div class="ep-state-actions">
              <button pButton type="button" [label]="'TRANSPORT_ESTIMATE.RETRY' | translate" (click)="reload()"></button>
              <button pButton type="button" class="p-button-outlined" [label]="'TRANSPORT_ESTIMATE.BACK' | translate" (click)="goBack()"></button>
            </div>
          </div>
        } @else if (result()) {
          <div class="ep-hero-card">
            @if (result()!.advisoryApplied && (result()!.reducedAvailability || result()!.possibleHigherPrice)) {
              <div class="ep-advisory" role="status">
                <div class="ep-advisory-icon" aria-hidden="true"><i class="pi pi-megaphone"></i></div>
                <div class="ep-advisory-body">
                  <span class="ep-advisory-label">{{ 'TRANSPORT_ESTIMATE.ADVISORY_LABEL' | translate }}</span>
                  @if (result()!.advisoryMessage) {
                    <p class="ep-advisory-msg">{{ result()!.advisoryMessage }}</p>
                  } @else {
                    <p class="ep-advisory-msg">{{ 'TRANSPORT_ESTIMATE.ADVISORY_GENERIC' | translate }}</p>
                  }
                </div>
              </div>
            }

            <div class="ep-price-panel">
              <div class="ep-price-main">
                <div class="ep-price-hero-label">
                  @if (showBand()) {
                    {{ 'TRANSPORT_ESTIMATE.PRICE_BLOCK_RANGE' | translate }}
                  } @else {
                    {{ 'TRANSPORT_ESTIMATE.PRICE_BLOCK_SINGLE' | translate }}
                  }
                  <button
                    type="button"
                    class="ep-icon-btn"
                    [pTooltip]="showBand() ? ('TRANSPORT_ESTIMATE.TOOLTIP_RANGE' | translate) : ('TRANSPORT_ESTIMATE.TOOLTIP_REFERENCE' | translate)"
                    tooltipPosition="top"
                    [attr.aria-label]="(showBand() ? 'TRANSPORT_ESTIMATE.TOOLTIP_RANGE' : 'TRANSPORT_ESTIMATE.TOOLTIP_REFERENCE') | translate">
                    <i class="pi pi-info-circle"></i>
                  </button>
                </div>
                @if (showBand()) {
                  <div class="ep-price-hero-value ep-price-hero-value--band">
                    <span class="ep-dual-currency">{{ result()!.minPriceTnd | dualCurrency }}</span>
                    <span class="ep-band-sep ep-band-sep--hero" aria-hidden="true">—</span>
                    <span class="ep-dual-currency">{{ result()!.maxPriceTnd | dualCurrency }}</span>
                  </div>
                  <p class="ep-ref-inline">
                    <span class="ep-ref-inline-label">{{ 'TRANSPORT_ESTIMATE.REFERENCE_INLINE' | translate }}</span>
                    <span class="ep-ref-inline-value ep-dual-currency">{{ result()!.referencePriceTnd | dualCurrency }}</span>
                  </p>
                  <p class="ep-band-hint">{{ 'TRANSPORT_ESTIMATE.RANGE_HINT' | translate }}</p>
                } @else {
                  <div class="ep-price-hero-value ep-dual-currency">{{ result()!.referencePriceTnd | dualCurrency }}</div>
                }
                @if (result()!.routeKm != null && result()!.routeKm! > 0) {
                  <p class="ep-route-km">
                    <i class="pi pi-compass" aria-hidden="true"></i>
                    {{ 'TRANSPORT_ESTIMATE.ROUTE_KM' | translate: { km: formatRouteKm(result()!.routeKm!) } }}
                  </p>
                }
              </div>
              <aside class="ep-trust-aside">
                <div class="ep-trust-aside-icon" aria-hidden="true"><i class="pi pi-chart-line"></i></div>
                <p class="ep-trust-aside-text">{{ 'TRANSPORT_ESTIMATE.TRUST_CALLOUT' | translate }}</p>
              </aside>
            </div>

            <div class="ep-good-grid">
              <div class="ep-good-card">
                <div class="ep-good-icon" aria-hidden="true"><i class="pi pi-info-circle"></i></div>
                <h3 class="ep-good-title">{{ 'TRANSPORT_ESTIMATE.GOOD_TITLE_1' | translate }}</h3>
                <p class="ep-good-body">{{ 'TRANSPORT_ESTIMATE.GOOD_BODY_1' | translate }}</p>
              </div>
              <div class="ep-good-card">
                <div class="ep-good-icon" aria-hidden="true"><i class="pi pi-ban"></i></div>
                <h3 class="ep-good-title">{{ 'TRANSPORT_ESTIMATE.GOOD_TITLE_2' | translate }}</h3>
                <p class="ep-good-body">{{ 'TRANSPORT_ESTIMATE.GOOD_BODY_2' | translate }}</p>
              </div>
              <div class="ep-good-card">
                <div class="ep-good-icon" aria-hidden="true"><i class="pi pi-calendar-times"></i></div>
                <h3 class="ep-good-title">{{ 'TRANSPORT_ESTIMATE.GOOD_TITLE_3' | translate }}</h3>
                <p class="ep-good-body">{{ 'TRANSPORT_ESTIMATE.GOOD_BODY_3' | translate }}</p>
              </div>
            </div>

            <div class="ep-footer-trust">
              <i class="pi pi-shield ep-footer-trust-icon" aria-hidden="true"></i>
              <p class="ep-footer-trust-text">{{ 'TRANSPORT_ESTIMATE.FOOTER_TRUST' | translate }}</p>
            </div>

            <div class="ep-actions-row">
              <button
                type="button"
                pButton
                class="p-button-text ep-link-btn"
                icon="pi pi-question-circle"
                [label]="'TRANSPORT_ESTIMATE.WHY_RANGE_BTN' | translate"
                (click)="openHelp()"></button>
            </div>
          </div>

          <p class="ep-tip">
            <i class="pi pi-lightbulb" aria-hidden="true"></i>
            <span>{{ 'TRANSPORT_ESTIMATE.TIP_FOOTER' | translate }}</span>
          </p>
        }
      </section>
      </div>
    </div>

    <p-dialog
      [header]="'TRANSPORT_ESTIMATE.DIALOG_TITLE' | translate"
      [modal]="true"
      [dismissableMask]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      appendTo="body"
      styleClass="ep-help-dialog"
      [style]="{ width: 'min(440px, 94vw)' }"
      [visible]="helpOpen()"
      (visibleChange)="onHelpVisible($event)">
      <p class="ep-dialog-lead">{{ 'TRANSPORT_ESTIMATE.DIALOG_LEAD' | translate }}</p>
      <ul class="ep-dialog-list">
        <li>{{ 'TRANSPORT_ESTIMATE.DIALOG_LI_1' | translate }}</li>
        <li>{{ 'TRANSPORT_ESTIMATE.DIALOG_LI_2' | translate }}</li>
        <li>{{ 'TRANSPORT_ESTIMATE.DIALOG_LI_3' | translate }}</li>
        <li>{{ 'TRANSPORT_ESTIMATE.DIALOG_LI_4' | translate }}</li>
      </ul>
      <ng-template pTemplate="footer">
        <button pButton type="button" [label]="'TRANSPORT_ESTIMATE.DIALOG_CLOSE' | translate" (click)="closeHelp()"></button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .ep {
      min-height: 100vh;
      padding-bottom: 3rem;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--mediterranean-blue) 10%, var(--bg-color)) 0%,
        var(--bg-color) 42%
      );
    }
    .ep-shell {
      max-width: 920px;
      margin: 0 auto;
      padding-inline: 1.25rem;
    }

    .ep-header {
      padding: 1.25rem 0 1rem;
    }
    .ep-header-top {
      margin-bottom: 1rem;
    }
    .ep-header-main {
      text-align: center;
    }
    .ep-badge {
      display: inline-block;
      margin: 0 0 0.75rem;
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--mediterranean-blue) 55%, var(--text-color));
      background: color-mix(in srgb, var(--mediterranean-blue) 14%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--mediterranean-blue) 28%, var(--glass-border));
    }
    .ep-back {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--glass-border, rgba(255,255,255,0.12));
      background: var(--surface-1, #111827);
      color: var(--text-color);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: border-color 0.2s, color 0.2s, box-shadow 0.2s;
    }
    .ep-back:hover {
      border-color: color-mix(in srgb, var(--mediterranean-blue) 45%, var(--glass-border));
      color: color-mix(in srgb, var(--mediterranean-blue) 35%, var(--text-color));
      box-shadow: 0 4px 14px color-mix(in srgb, var(--mediterranean-blue) 18%, transparent);
    }
    .ep-title {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(1.5rem, 4.5vw, 2rem);
      font-weight: 800;
      margin: 0 0 0.5rem;
      color: var(--text-color);
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .ep-sub {
      font-size: 0.92rem;
      color: var(--text-muted);
      margin: 0 auto;
      max-width: 34rem;
      line-height: 1.55;
    }

    .ep-summary-card {
      margin: 0 0 1.25rem;
      padding: 1.1rem 1.25rem 1.15rem;
      border-radius: 18px;
      background: var(--surface-1);
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow-card, 0 8px 28px color-mix(in srgb, #000 8%, transparent));
    }
    .ep-route {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .ep-route-pin {
      color: var(--tunisia-red);
      font-size: 1.15rem;
      flex-shrink: 0;
    }
    .ep-route-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .ep-city {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(1.05rem, 3vw, 1.25rem);
      font-weight: 700;
      color: var(--text-color);
    }
    .ep-arrow { color: var(--tunisia-red); font-weight: 800; font-size: 1.1rem; }
    .ep-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    .ep-meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--text-muted);
      background: color-mix(in srgb, var(--text-color) 4%, transparent);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.06));
    }
    :host ::ng-deep .ep-tag-type.p-tag {
      font-weight: 700;
      font-size: 0.78rem;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
    }

    .ep-body { padding: 0 0 2rem; }

    .ep-state {
      text-align: center;
      padding: 2rem 1.5rem;
      border-radius: 22px;
      border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
      background: var(--surface-1, #111827);
    }
    .ep-state-icon {
      width: 56px; height: 56px; margin: 0 auto 1rem;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.45rem;
    }
    .ep-state--warn .ep-state-icon {
      background: color-mix(in srgb, #f59e0b 18%, transparent);
      color: #f59e0b;
    }
    .ep-state--route .ep-state-icon {
      background: color-mix(in srgb, var(--mediterranean-blue) 18%, transparent);
      color: color-mix(in srgb, var(--mediterranean-blue) 45%, var(--text-color));
    }
    .ep-state--error .ep-state-icon {
      background: color-mix(in srgb, var(--tunisia-red) 15%, transparent);
      color: var(--tunisia-red);
    }
    .ep-state-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: var(--text-color);
    }
    .ep-state-text {
      font-size: 0.88rem;
      color: var(--text-muted);
      margin: 0 0 1.35rem;
      line-height: 1.55;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }
    .ep-state-actions {
      display: flex; flex-wrap: wrap; gap: 0.65rem;
      justify-content: center;
    }

    .ep-skeleton-card {
      padding: 1.5rem 1.35rem;
      border-radius: 22px;
      border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
      background: var(--surface-1, #111827);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    :host ::ng-deep .ep-sk.p-skeleton { background: color-mix(in srgb, var(--text-muted) 22%, transparent); }
    :host ::ng-deep .ep-sk-hero.p-skeleton { min-height: 5.5rem; }
    .ep-skeleton-hint {
      text-align: center;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .ep-hero-card {
      padding: 0;
      border-radius: 22px;
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 22%, var(--glass-border));
      background: linear-gradient(
        165deg,
        color-mix(in srgb, var(--tunisia-red) 7%, var(--surface-1)) 0%,
        var(--surface-1) 40%,
        var(--surface-1) 100%
      );
      box-shadow: var(--shadow-soft, 0 12px 40px color-mix(in srgb, #000 12%, transparent));
      overflow: hidden;
    }
    .ep-advisory {
      display: flex; gap: 0.85rem;
      padding: 1rem 1.25rem;
      margin: 0;
      background: color-mix(in srgb, #f59e0b 11%, var(--surface-1));
      border-bottom: 1px solid color-mix(in srgb, #f59e0b 28%, transparent);
      text-align: left;
    }
    .ep-advisory-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      border-radius: 12px;
      background: color-mix(in srgb, #f59e0b 22%, transparent);
      display: flex; align-items: center; justify-content: center;
      color: #d97706;
      font-size: 1.1rem;
    }
    .ep-advisory-label {
      display: block;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #b45309;
      margin-bottom: 0.25rem;
    }
    .ep-advisory-msg { margin: 0; font-size: 0.88rem; line-height: 1.5; color: var(--text-color); }

    .ep-price-panel {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
      padding: 1.5rem 1.35rem 1.35rem;
      align-items: stretch;
    }
    /* Two columns only when the price block has enough width for dual-currency + large type */
    @media (min-width: 768px) {
      .ep-price-panel {
        grid-template-columns: minmax(22rem, 1fr) minmax(9rem, 11.25rem);
        gap: 1.25rem 1.5rem;
        padding: 1.65rem 1.5rem 1.5rem;
      }
    }
    .ep-price-main {
      padding: 1rem 1.1rem 1.1rem;
      border-radius: 16px;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--tunisia-red) 11%, var(--surface-1)) 0%,
        color-mix(in srgb, var(--surface-2) 88%, var(--surface-1)) 100%
      );
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 26%, var(--glass-border));
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-color) 7%, transparent);
    }
    .ep-price-hero-label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: color-mix(in srgb, var(--text-muted) 35%, var(--text-color));
      margin-bottom: 0.5rem;
    }
    .ep-dual-currency {
      display: block;
      width: max-content;
      max-width: 100%;
      white-space: nowrap;
      overflow-x: visible;
      overflow-y: visible;
      vertical-align: bottom;
    }
    .ep-price-hero-value {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(2.15rem, 7vw, 2.85rem);
      font-weight: 800;
      color: var(--tunisia-red);
      letter-spacing: -0.035em;
      line-height: 1.08;
      text-shadow: 0 1px 0 color-mix(in srgb, var(--surface-1) 40%, transparent),
        0 2px 20px color-mix(in srgb, var(--tunisia-red) 18%, transparent);
    }
    .ep-price-hero-value--band {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem 0.55rem;
    }
    .ep-band-sep--hero {
      font-size: clamp(1.25rem, 4vw, 1.6rem);
      opacity: 0.55;
    }
    .ep-ref-inline {
      margin: 0.65rem 0 0;
      font-size: 0.82rem;
      color: var(--text-muted);
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem;
    }
    .ep-ref-inline-label { font-weight: 600; }
    .ep-ref-inline-value {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      color: var(--text-color);
    }
    .ep-band-hint {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin: 0.55rem 0 0;
      line-height: 1.45;
    }
    .ep-band-sep { color: var(--text-muted); font-weight: 600; flex-shrink: 0; }

    .ep-trust-aside {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 1rem 1rem 1.1rem;
      border-radius: 14px;
      background: color-mix(in srgb, var(--mediterranean-blue) 12%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--mediterranean-blue) 26%, var(--glass-border));
    }
    .ep-trust-aside-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--mediterranean-blue) 18%, transparent);
      color: color-mix(in srgb, var(--mediterranean-blue) 55%, var(--text-color));
      font-size: 1.05rem;
    }
    .ep-trust-aside-text {
      margin: 0;
      font-size: 0.82rem;
      line-height: 1.5;
      color: var(--text-color);
      font-weight: 500;
    }

    .ep-good-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      padding: 0 1.25rem 1.25rem;
    }
    @media (min-width: 640px) {
      .ep-good-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 0.85rem;
        padding: 0 1.35rem 1.35rem;
      }
    }
    .ep-good-card {
      padding: 1rem 0.95rem;
      border-radius: 14px;
      background: color-mix(in srgb, var(--text-color) 3.5%, transparent);
      border: 1px solid var(--glass-border, rgba(255,255,255,0.06));
      text-align: start;
    }
    .ep-good-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.6rem;
      background: color-mix(in srgb, var(--tunisia-red) 14%, transparent);
      color: var(--tunisia-red);
      font-size: 0.95rem;
    }
    .ep-good-card:nth-child(2) .ep-good-icon {
      background: color-mix(in srgb, var(--mediterranean-blue) 16%, transparent);
      color: color-mix(in srgb, var(--mediterranean-blue) 50%, var(--text-color));
    }
    .ep-good-card:nth-child(3) .ep-good-icon {
      background: color-mix(in srgb, #a855f7 14%, transparent);
      color: #c084fc;
    }
    .ep-good-title {
      font-family: 'Outfit', sans-serif;
      font-size: 0.88rem;
      font-weight: 700;
      margin: 0 0 0.35rem;
      color: var(--text-color);
      letter-spacing: -0.01em;
    }
    .ep-good-body {
      margin: 0;
      font-size: 0.78rem;
      line-height: 1.5;
      color: var(--text-muted);
    }

    .ep-footer-trust {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin: 0 1.25rem 0.5rem;
      padding: 0.95rem 1rem;
      border-radius: 12px;
      background: color-mix(in srgb, var(--mediterranean-blue) 12%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--mediterranean-blue) 24%, var(--glass-border));
    }
    @media (min-width: 640px) {
      .ep-footer-trust { margin-inline: 1.35rem; }
    }
    .ep-footer-trust-icon {
      flex-shrink: 0;
      margin-top: 0.1rem;
      font-size: 1.1rem;
      color: color-mix(in srgb, var(--mediterranean-blue) 55%, var(--text-color));
    }
    .ep-footer-trust-text {
      margin: 0;
      font-size: 0.8rem;
      line-height: 1.5;
      color: var(--text-color);
    }

    .ep-tip {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      margin: 1rem 0 0;
      padding: 0.9rem 1.1rem;
      border-radius: 14px;
      font-size: 0.8rem;
      line-height: 1.5;
      color: var(--text-color);
      background: color-mix(in srgb, var(--mediterranean-blue) 11%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--mediterranean-blue) 22%, var(--glass-border));
    }
    .ep-tip .pi {
      flex-shrink: 0;
      margin-top: 0.12rem;
      font-size: 1rem;
      color: var(--mediterranean-blue);
      opacity: 0.95;
    }

    .ep-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.65rem;
      height: 1.65rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.2s, background 0.2s;
    }
    .ep-icon-btn:hover {
      color: var(--tunisia-red);
      background: color-mix(in srgb, var(--tunisia-red) 12%, transparent);
    }
    .ep-icon-btn .pi { font-size: 0.95rem; }

    .ep-route-km {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0.85rem 0 0;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .ep-route-km .pi { color: var(--tunisia-red); opacity: 0.9; }

    .ep-actions-row {
      padding: 0.35rem 1rem 1.2rem;
      display: flex;
      justify-content: center;
    }
    :host ::ng-deep .ep-link-btn.p-button {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--tunisia-red);
    }

    :host ::ng-deep .ep-help-dialog .p-dialog-header {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      padding: 1.1rem 1.25rem;
    }
    :host ::ng-deep .ep-help-dialog .p-dialog-content {
      padding: 0 1.25rem 0.5rem;
    }
    :host ::ng-deep .ep-help-dialog .p-dialog-footer {
      padding: 0.75rem 1.25rem 1.1rem;
      gap: 0.5rem;
    }
    .ep-dialog-lead {
      margin: 0 0 1rem;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.55;
    }
    .ep-dialog-list {
      margin: 0;
      padding-left: 1.15rem;
      font-size: 0.86rem;
      color: var(--text-color);
      line-height: 1.55;
    }
    .ep-dialog-list li { margin-bottom: 0.45rem; }

    @media (max-width: 480px) {
      .ep-meta { flex-direction: column; align-items: stretch; }
      .ep-meta-chip, :host ::ng-deep .ep-tag-type.p-tag { justify-content: center; }
    }

    /* Brighter info accents on dark theme (parent layout sets data-theme on html). */
    :host-context(html[data-theme='dark']) .ep-trust-aside-icon,
    :host-context(html[data-theme='dark']) .ep-footer-trust-icon {
      color: #7dd3fc;
    }
    :host-context(html[data-theme='dark']) .ep-tip .pi {
      color: #7dd3fc;
    }
  `],
})
export class TransportEstimatePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(TripContextStore);
  private dataSource = inject(DATA_SOURCE_TOKEN);
  private alerts = inject(AppAlertsService);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  /** Re-render when display currency or FX snapshot changes (OnPush + dualCurrency). */
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();

  cities = signal<City[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  result = signal<TransportEstimateResult | null>(null);
  helpOpen = signal(false);

  private qpFrom = signal<string>('');
  private qpTo = signal<string>('');
  private qpDate = signal<string>('');
  private qpType = signal<string>('');
  private qpPassengers = signal(1);

  transportType = computed(() => (this.qpType() || '').toUpperCase());

  missingQuery = computed(() => {
    const f = this.qpFrom().trim();
    const t = this.qpTo().trim();
    const d = this.qpDate().trim();
    const ty = this.transportType();
    return !f || !t || !d || !ty;
  });

  invalidType = computed(() => {
    const t = this.transportType();
    return t.length > 0 && !isEstimateOnlyType(t);
  });
  seats = computed(() => Math.max(1, this.qpPassengers()));

  departureName = computed(() => this.cityName(this.qpFrom()));
  arrivalName = computed(() => this.cityName(this.qpTo()));

  dateLabel = computed(() => {
    const raw = this.qpDate();
    if (!raw) return '—';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
  });

  taxiNeedsRoute = computed(() => {
    if (this.transportType() !== 'TAXI') {
      return false;
    }
    const km = this.store.transportRouteKm();
    return km == null || km <= 0;
  });

  ngOnInit(): void {
    this.dataSource.getCities().subscribe({
      next: (c) => {
        this.cities.set(c);
        this.cdr.markForCheck();
      },
      error: () => {},
    });

    this.route.queryParamMap.subscribe((qm) => {
      this.qpFrom.set(qm.get('from') ?? '');
      this.qpTo.set(qm.get('to') ?? '');
      this.qpDate.set(qm.get('date') ?? '');
      this.qpType.set((qm.get('transportType') ?? '').toUpperCase());
      const p = parseInt(qm.get('passengers') ?? '1', 10);
      this.qpPassengers.set(Number.isFinite(p) && p > 0 ? p : 1);

      const td = qm.get('date');
      if (td) {
        this.store.setDates({ travelDate: td });
      }

      if (this.missingQuery()) {
        this.loading.set(false);
        this.result.set(null);
        this.errorMessage.set(null);
        this.cdr.markForCheck();
        return;
      }
      if (this.invalidType()) {
        this.loading.set(false);
        this.result.set(null);
        this.errorMessage.set(null);
        this.cdr.markForCheck();
        return;
      }
      if (this.taxiNeedsRoute()) {
        this.loading.set(false);
        this.result.set(null);
        this.errorMessage.set(null);
        this.cdr.markForCheck();
        return;
      }
      this.fetchEstimate();
    });
  }

  openHelp(): void {
    this.helpOpen.set(true);
    this.cdr.markForCheck();
  }

  closeHelp(): void {
    this.helpOpen.set(false);
    this.cdr.markForCheck();
  }

  onHelpVisible(v: boolean): void {
    this.helpOpen.set(v);
    this.cdr.markForCheck();
  }

  showBand(): boolean {
    const r = this.result();
    if (!r) {
      return false;
    }
    return r.advisoryApplied === true || Math.abs(r.minPriceTnd - r.maxPriceTnd) > 0.02;
  }

  /** Whole km for the route footnote. */
  formatRouteKm(n: number): string {
    return String(Math.round(Number.isFinite(n) ? n : 0));
  }

  goBack(): void {
    void this.router.navigate(['/transport/results'], {
      queryParams: {
        from: this.qpFrom(),
        to: this.qpTo(),
        date: this.qpDate(),
        transportType: this.qpType(),
        passengers: String(this.qpPassengers()),
      },
    });
  }

  goTransportHome(): void {
    void this.router.navigate(['/transport']);
  }

  reload(): void {
    this.fetchEstimate();
  }

  private cityName(idStr: string): string {
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id)) {
      return '—';
    }
    return this.cities().find((c) => c.id === id)?.name ?? `#${id}`;
  }

  private fetchEstimate(): void {
    if (this.invalidType() || !isEstimateOnlyType(this.transportType())) {
      return;
    }
    if (this.transportType() === 'TAXI' && this.taxiNeedsRoute()) {
      return;
    }

    const fromId = parseInt(this.qpFrom(), 10);
    const toId = parseInt(this.qpTo(), 10);
    if (!Number.isFinite(fromId) || !Number.isFinite(toId) || fromId === toId) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_ESTIMATE.ALERT_BAD_ROUTE_TITLE'),
        this.translate.instant('TRANSPORT_ESTIMATE.ALERT_BAD_ROUTE_BODY'),
      );
      void this.router.navigate(['/transport']);
      return;
    }

    const dateRaw = this.qpDate();
    const travelDate =
      dateRaw && dateRaw.length >= 10 ? dateRaw.slice(0, 10) : new Date().toISOString().slice(0, 10);

    const km = this.store.transportRouteKm();
    const routeKm = km != null && km > 0 ? km : undefined;
    const routeDurationMin = this.store.transportRouteDurationMin() ?? undefined;

    const user = this.auth.currentUser();
    const userId =
      user != null ? ((user as { id?: number; userId?: number }).id ?? (user as { userId?: number }).userId) : undefined;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.result.set(null);
    this.cdr.markForCheck();

    this.dataSource
      .estimateTransport({
        departureCityId: fromId,
        arrivalCityId: toId,
        travelDate,
        transportType: this.transportType() as TransportType,
        seats: this.seats(),
        routeKm,
        routeDurationMin,
        userId: userId != null && Number.isFinite(userId) ? userId : undefined,
      })
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set(this.translate.instant('TRANSPORT_ESTIMATE.ERROR_LOAD'));
          this.cdr.markForCheck();
        },
      });
  }
}
