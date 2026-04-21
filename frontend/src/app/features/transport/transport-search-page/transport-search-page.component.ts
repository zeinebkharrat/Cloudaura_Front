import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { AppAlertsService } from '../../../core/services/app-alerts.service';
import { City, CityInfrastructure, TransportType, TRANSPORT_TYPE_META, TransportTypeAvailability } from '../../../core/models/travel.models';
import { TunisiaCityMatchService } from '../tunisia-city-match.service';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { tunisiaAirportIataForCity } from '../../../core/utils/tunisia-airport-iata.util';

interface TypeCard {
  type: TransportType;
  labelKey: string;
  iconPath: string;
  available: boolean;
  reason?: string;
}

const VISIBLE_TYPES: TransportType[] = ['BUS', 'TAXI', 'CAR', 'PLANE'];

@Component({
  selector: 'app-transport-search-page',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="transport-home">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-glow"></div>
        <div class="hero-content">
          <h1 class="hero-title">{{ 'TRANSPORT_SEARCH.HERO_TITLE' | translate }}</h1>
          <p class="hero-sub">{{ 'TRANSPORT_SEARCH.HERO_SUB' | translate }}</p>
        </div>
      </section>

      <!-- Search Bar -->
      <section class="search-section">
        <form [formGroup]="searchForm" class="search-bar">
          <!-- Departure -->
          <div class="sb-field sb-city">
            <span class="sb-icon"><i class="pi pi-map-marker"></i></span>
            <div class="sb-inner">
              <span class="sb-label">{{ 'TRANSPORT_SEARCH.FROM' | translate }}</span>
              <p-select
                formControlName="from"
                [options]="cities()"
                optionLabel="name"
                optionValue="id"
                [filter]="true"
                filterBy="name"
                [placeholder]="'TRANSPORT_SEARCH.PLACEHOLDER_FROM' | translate"
                [showClear]="false"
                appendTo="body"
                styleClass="sb-dropdown"
                panelStyleClass="transport-city-panel">
              </p-select>
            </div>
          </div>

          <!-- Swap -->
          <button type="button" class="sb-swap" (click)="swapCities()" pRipple
                  [pTooltip]="'TRANSPORT_SEARCH.SWAP_TT' | translate" tooltipPosition="top">
            <i class="pi pi-arrows-h"></i>
          </button>

          <!-- Arrival -->
          <div class="sb-field sb-city">
            <span class="sb-icon"><i class="pi pi-flag"></i></span>
            <div class="sb-inner">
              <span class="sb-label">{{ 'TRANSPORT_SEARCH.TO' | translate }}</span>
              <p-select
                formControlName="to"
                [options]="cities()"
                optionLabel="name"
                optionValue="id"
                [filter]="true"
                filterBy="name"
                [placeholder]="'TRANSPORT_SEARCH.PLACEHOLDER_TO' | translate"
                [showClear]="false"
                appendTo="body"
                styleClass="sb-dropdown"
                panelStyleClass="transport-city-panel">
              </p-select>
            </div>
          </div>

          <div class="sb-divider"></div>

          <!-- Date -->
          <div class="sb-field sb-date">
            <span class="sb-icon"><i class="pi pi-calendar"></i></span>
            <div class="sb-inner">
              <span class="sb-label">{{ 'TRANSPORT_SEARCH.DATE_TIME' | translate }}</span>
              <p-datepicker
                formControlName="date"
                dateFormat="dd/mm/yy"
                [minDate]="today"
                [showTime]="true"
                hourFormat="24"
                [showSeconds]="false"
                [stepHour]="1"
                [stepMinute]="15"
                [showButtonBar]="true"
                [showIcon]="false"
                [touchUI]="false"
                [readonlyInput]="true"
                [keepInvalid]="false"
                [placeholder]="'TRANSPORT_SEARCH.PLACEHOLDER_DATE' | translate"
                styleClass="sb-calendar"
                panelStyleClass="transport-search-calendar-panel">
              </p-datepicker>
            </div>
          </div>

          <div class="sb-divider"></div>

          <!-- Passengers -->
          <div class="sb-field sb-pax">
            <span class="sb-icon"><i class="pi pi-users"></i></span>
            <div class="sb-inner">
              <span class="sb-label">{{ 'TRANSPORT_SEARCH.PASSENGERS' | translate }}</span>
              <div class="sb-pax-shell">
                <p-inputNumber
                  formControlName="passengers"
                  [min]="1" [max]="20"
                  [showButtons]="true"
                  buttonLayout="horizontal"
                  incrementButtonIcon="pi pi-plus"
                  decrementButtonIcon="pi pi-minus"
                  [fluid]="false"
                  styleClass="sb-pax-input">
                </p-inputNumber>
              </div>
            </div>
          </div>
        </form>
      </section>

      @if (hasBothCities()) {
        <section class="map-section">
          <app-transport-route-map
            [fromCity]="cityById(fromCityId())"
            [toCity]="cityById(toCityId())"
            (routeSummary)="onRouteSummary($event)" />
        </section>
      }

      <!-- Transport Types -->
      <section class="types-section">
        <h2 class="types-title">
          {{ (hasBothCities() ? 'TRANSPORT_SEARCH.TYPES_TITLE_BOTH' : 'TRANSPORT_SEARCH.TYPES_TITLE_WAIT') | translate }}
        </h2>

        <div class="types-grid">
          @for (card of typeCards(); track card.type) {
            <div class="tcard"
                 [class.tcard-active]="card.available"
                 [class.tcard-disabled]="!card.available && hasBothCities()"
                 [class.tcard-waiting]="!hasBothCities()"
                 [pTooltip]="card.reason ?? ''"
                 tooltipPosition="top"
                 (click)="onTypeClick(card)">

              <div class="tcard-icon">
                <img
                  [src]="card.iconPath"
                  [alt]="card.labelKey | translate"
                  class="tcard-img"
                  [class.tcard-img-bus]="card.type === 'BUS'"
                  [class.tcard-img-plane]="card.type === 'PLANE'" />
              </div>
              <span class="tcard-name">{{ card.labelKey | translate }}</span>

              @if (card.available) {
                <span class="tcard-badge tcard-ok">{{ 'TRANSPORT_SEARCH.AVAILABLE' | translate }}</span>
              } @else if (hasBothCities()) {
                <span class="tcard-badge tcard-no">{{ 'TRANSPORT_SEARCH.UNAVAILABLE' | translate }}</span>
              }
            </div>
          }
        </div>
      </section>

      <!-- Popular Routes -->
      <section class="popular">
        <h3 class="popular-heading">{{ 'TRANSPORT_SEARCH.POPULAR_HEADING' | translate }}</h3>
        <div class="popular-list">
          @for (r of popularRoutes; track r.labelKey) {
            <button class="pop-chip" pRipple (click)="quickSearch(r)">
              <img
                [src]="r.icon"
                [alt]="r.type"
                class="pop-icon-img"
                [class.pop-icon-bus]="r.type === 'BUS'"
                [class.pop-icon-plane]="r.type === 'PLANE'" />
              {{ r.labelKey | translate }}
              <i class="pi pi-chevron-right pop-arrow"></i>
            </button>
          }
        </div>
      </section>

      <button
        type="button"
        class="intl-flights-btn"
        pRipple
        [pTooltip]="'TRANSPORT_SEARCH.INTL_FLIGHTS_TT' | translate"
        tooltipPosition="right"
        (click)="navigateInternationalFlights()"
      >
        <img src="/icones/avion.png" alt="" class="intl-flights-btn-icon" aria-hidden="true" />
        <span>{{ 'TRANSPORT_SEARCH.INTL_FLIGHTS_BTN' | translate }}</span>
      </button>
    </div>
  `,
  styles: [`
    .transport-home {
      min-height: 100vh;
      padding-bottom: 4rem;
      background: var(--bg-color);
      transition: background-color 0.3s ease;
    }

    /* ---- Hero ---- */
    .hero { position: relative; text-align: center; padding: 3rem 2rem 2.5rem; overflow: hidden; }
    .hero-glow {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 55% 45% at 50% 0%, rgba(241,37,69,0.08) 0%, transparent 72%);
    }
    :host-context([data-theme="light"]) .hero-glow {
      background: radial-gradient(ellipse 55% 45% at 50% 0%, rgba(241,37,69,0.05) 0%, transparent 72%);
    }
    :host-context([data-theme="dark"]) .hero-glow {
      background:
        radial-gradient(ellipse 60% 50% at 50% 0%, rgba(241,37,69,0.14) 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 85% 15%, rgba(241,37,69,0.06) 0%, transparent 70%);
    }
    .hero-content { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; }
    .hero-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.6rem; font-weight: 800; margin: 0 0 0.6rem;
      background: linear-gradient(135deg, var(--text-color) 0%, rgba(241,37,69,0.88) 100%);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero-sub { font-size: 1.05rem; color: var(--text-muted); margin: 0; line-height: 1.6; }

    /* ---- Search bar (white card light / elevated slate dark) ---- */
    /* Keep below body-appended overlays; calendar uses appendTo="body" */
    .search-section { padding: 0 1.5rem; margin-top: 0.5rem; position: relative; z-index: 2; }
    .map-section { max-width: 1320px; margin: 1rem auto 0; padding: 0 1.5rem; }
    .search-bar {
      max-width: 1320px; margin: 0 auto;
      display: flex; align-items: stretch;
      overflow: visible;
      background: var(--surface-1);
      border: 1px solid var(--border-soft);
      border-radius: 16px;
      box-shadow: var(--shadow-card);
      transition: box-shadow 0.28s ease, border-color 0.22s ease;
    }
    :host-context([data-theme="light"]) .search-bar {
      box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04), 0 0 0 1px rgba(15,23,42,0.03);
    }
    :host-context([data-theme="dark"]) .search-bar {
      box-shadow: var(--shadow-soft);
    }
    .search-bar:focus-within {
      border-color: color-mix(in srgb, var(--tunisia-red) 38%, var(--border-soft));
      box-shadow: var(--shadow-card), 0 0 0 3px rgba(241,37,69,0.12);
    }

    .sb-field {
      display: flex; align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.125rem 1.1rem;
      flex: 1; min-width: 0;
      border-radius: 12px;
      transition: background 0.2s ease;
    }
    :host-context([data-theme="light"]) .sb-field:hover { background: rgba(15,23,42,0.025); }
    :host-context([data-theme="dark"]) .sb-field:hover { background: rgba(255,255,255,0.04); }
    .sb-city { flex: 1.25 1 0; min-width: 0; }
    .sb-date { flex: 2.4 1 14rem; min-width: 12rem; }
    .sb-date .sb-inner { min-width: 0; overflow: visible; }
    .sb-pax {
      flex: 0 1 15rem;
      min-width: 12.5rem;
      max-width: 16rem;
      padding-right: 1.25rem;
      padding-bottom: 1.05rem;
      align-items: center;
    }
    .sb-pax .sb-icon {
      margin-top: 0;
      align-self: center;
    }
    .sb-pax .sb-inner {
      min-height: 0;
      justify-content: center;
      align-items: flex-start;
      min-width: 0;
    }

    .sb-icon {
      width: 40px; height: 40px; border-radius: 12px;
      margin-top: 1.2rem;
      background: color-mix(in srgb, var(--tunisia-red) 10%, transparent);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: transform 0.2s ease, background 0.2s ease;
    }
    .sb-field:hover .sb-icon { transform: scale(1.03); background: color-mix(in srgb, var(--tunisia-red) 16%, transparent); }
    .sb-icon i { font-size: 1rem; color: var(--tunisia-red); opacity: 0.92; }

    .sb-inner { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
    .sb-label {
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0;
    }

    .sb-divider { width: 1px; background: var(--border-soft); margin: 0.625rem 0; flex-shrink: 0; align-self: stretch; }

    .sb-swap {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      background: var(--surface-2);
      border: 1px solid var(--border-soft);
      color: var(--text-color); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      align-self: center;
      margin-top: 1.85rem;
      margin-left: -0.25rem;
      margin-right: -0.25rem;
      transition: background 0.22s ease, color 0.22s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease;
      z-index: 2;
    }
    .sb-swap:hover {
      background: var(--tunisia-red);
      color: #fff;
      transform: rotate(180deg);
      box-shadow: 0 6px 18px var(--tunisia-red-glow);
    }
    .sb-swap i { font-size: 0.85rem; }

    .sb-pax-shell {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      width: fit-content;
      max-width: 100%;
      margin-top: 0;
      box-sizing: border-box;
      align-self: flex-start;
    }

    /* ---- PrimeNG inside search bar ---- */
    :host ::ng-deep {
      /* Ne pas forcer 100% sur le stepper passagers — sinon le « + » part au bord de la colonne */
      .sb-dropdown,
      .sb-calendar {
        width: 100%;
      }

      .sb-pax-input {
        display: inline-flex !important;
        width: max-content !important;
        max-width: 100% !important;
        flex: 0 0 auto !important;
      }

      .sb-dropdown .p-select {
        background: transparent !important; border: none !important;
        box-shadow: none !important; padding: 0;
      }
      :host-context([data-theme="light"]) .sb-dropdown .p-select.p-inputwrapper {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
      .sb-dropdown .p-select-label {
        padding: 0.2rem 0 !important; font-weight: 600;
        font-size: 0.95rem; color: var(--text-color) !important;
        transition: color 0.2s ease;
      }
      .sb-dropdown .p-select.p-inputwrapper-filled .p-select-label:not(.p-placeholder) {
        color: var(--tunisia-red) !important;
      }
      .sb-dropdown .p-select.p-inputwrapper-filled .p-select-dropdown {
        color: color-mix(in srgb, var(--tunisia-red) 75%, var(--text-muted)) !important;
      }
      .sb-dropdown .p-select-label.p-placeholder { color: var(--text-muted) !important; opacity: 0.9; }
      .sb-dropdown .p-select-dropdown { color: var(--text-muted) !important; transition: color 0.2s ease; }
      .sb-dropdown .p-select:not(.p-disabled).p-focus .p-select-label { color: var(--text-color) !important; }
      .sb-dropdown .p-select:not(.p-disabled).p-focus.p-inputwrapper-filled .p-select-label:not(.p-placeholder) {
        color: var(--tunisia-red) !important;
      }

      /* Panneau villes (.transport-city-panel) : appendTo body → styles dans styles.css */

      .sb-calendar .p-datepicker { background: transparent !important; width: 100%; display: block; }
      .sb-calendar .p-inputtext {
        background: transparent !important; border: none !important;
        box-shadow: none !important; padding: 0.2rem 0 !important;
        font-weight: 600; font-size: 0.95rem; color: var(--text-color) !important;
        width: 100% !important; min-width: 0;
      }

      .p-select-overlay,
      .transport-search-calendar-panel,
      .p-datepicker-panel {
        background: color-mix(in srgb, var(--surface-1) 94%, #000 6%) !important;
        border: 1px solid var(--border-soft) !important;
        border-radius: 12px !important;
        box-shadow: 0 16px 40px rgba(2, 8, 23, 0.55) !important;
        backdrop-filter: blur(8px);
      }
      .p-select-overlay {
        z-index: 1205 !important;
      }
      .transport-search-calendar-panel,
      .p-datepicker-panel {
        z-index: 1206 !important;
      }
      .p-select-overlay .p-select-option,
      .p-select-overlay .p-select-header,
      .p-select-overlay .p-select-empty-message,
      .transport-search-calendar-panel .p-datepicker-header,
      .transport-search-calendar-panel table th,
      .transport-search-calendar-panel table td > span,
      .p-datepicker-panel .p-datepicker-header,
      .p-datepicker-panel table th,
      .p-datepicker-panel table td > span {
        color: var(--text-color) !important;
      }
      .p-select-overlay:not(.transport-city-panel) .p-select-option:hover,
      .transport-search-calendar-panel table td > span:hover,
      .p-datepicker-panel table td > span:hover {
        background: color-mix(in srgb, var(--tunisia-red) 14%, transparent) !important;
      }
      .p-select-overlay:not(.transport-city-panel) .p-select-option.p-select-option-selected,
      .transport-search-calendar-panel table td > span.p-highlight,
      .p-datepicker-panel table td > span.p-highlight {
        background: var(--tunisia-red) !important;
        color: #fff !important;
      }

      .sb-pax-shell .p-inputnumber {
        display: inline-flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.35rem !important;
        padding: 0.25rem 0.4rem !important;
        border-radius: 12px !important;
        border: 1px solid var(--border-soft) !important;
        background: var(--input-bg) !important;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04) !important;
        width: max-content !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        flex-wrap: nowrap !important;
        flex: 0 0 auto !important;
      }
      :host-context([data-theme="dark"]) .sb-pax-shell .p-inputnumber {
        box-shadow: none !important;
      }
      .sb-pax-shell .p-inputnumber-horizontal .p-inputnumber-input,
      .sb-pax-shell .p-inputnumber .p-inputnumber-input {
        background: transparent !important; border: none !important;
        box-shadow: none !important; padding: 0.3rem 0.15rem !important;
        font-weight: 700; font-size: 0.95rem; color: var(--text-color) !important;
        text-align: center;
        width: 2rem !important;
        min-width: 2rem !important;
        max-width: 2.5rem !important;
        flex: 0 0 auto !important;
        flex-grow: 0 !important;
        flex-shrink: 0 !important;
        margin: 0 !important;
      }
      .sb-pax-shell .p-inputnumber-input.p-inputtext-fluid {
        width: 2rem !important;
        max-width: 2.5rem !important;
      }
      .sb-pax-input .p-inputnumber-button,
      .sb-pax-shell .p-inputnumber-button {
        position: relative !important;
        inset: auto !important;
        background: color-mix(in srgb, var(--tunisia-red) 12%, transparent) !important;
        border: none !important;
        color: var(--tunisia-red) !important;
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
        border-radius: 10px !important;
        flex: 0 0 auto !important;
        flex-shrink: 0 !important;
        margin: 0 !important;
        transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease !important;
      }
      .sb-pax-input .p-inputnumber-button:hover,
      .sb-pax-shell .p-inputnumber-button:hover {
        background: var(--tunisia-red) !important;
        color: #fff !important;
        transform: scale(1.05);
      }
    }

    /* ---- Transport Type Cards (stay under PrimeNG overlays) ---- */
    .types-section {
      max-width: 900px; margin: 2.5rem auto 0; padding: 0 1.5rem;
      position: relative;
      z-index: 0;
      isolation: isolate;
    }
    .types-title {
      text-align: center; font-size: 1.15rem; font-weight: 600;
      color: var(--text-muted); margin-bottom: 1.75rem;
    }
    .types-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
    }

    .tcard {
      display: flex; flex-direction: column; align-items: center; gap: 0.65rem;
      padding: 2rem 1rem 1.5rem;
      background: var(--surface-1);
      border: 1px solid var(--border-soft);
      border-radius: 16px; cursor: pointer; position: relative;
      box-shadow: var(--shadow-card);
      transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.25s ease;
    }
    .tcard-icon {
      display: flex; align-items: center; justify-content: center;
      width: 3.25rem;
      height: 3.25rem;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .tcard-img {
      display: block;
      width: 2.8rem;
      height: 2.8rem;
      object-fit: contain;
      transform-origin: center;
      filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--text-color) 12%, transparent));
    }
    .tcard-img-bus { transform: translateY(1px) scale(1.04); }
    .tcard-img-plane { transform: translateY(-1px) scale(1.03); }
    .tcard-disabled .tcard-img, .tcard-waiting .tcard-img { opacity: 0.4; filter: grayscale(1); }
    .tcard-name { font-weight: 700; font-size: 0.95rem; color: var(--text-color); }
    .tcard-badge {
      font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.65rem;
      border-radius: 50px; letter-spacing: 0.2px;
    }
    .tcard-ok { background: rgba(241,37,69,0.12); color: #f12545; }
    .tcard-no { background: rgba(239,68,68,0.12); color: #f87171; }

    .tcard-waiting { opacity: 0.4; cursor: default; }

    .tcard-active {
      opacity: 1;
      background: linear-gradient(180deg, rgba(241,37,69,0.05) 0%, transparent 60%);
      border-color: rgba(241,37,69,0.2);
    }
    .tcard-active:hover {
      transform: translateY(-8px);
      border-color: #f12545;
      box-shadow: 0 16px 40px rgba(241,37,69,0.15);
    }
    .tcard-active:hover .tcard-icon { transform: scale(1.2) rotate(-5deg); }

    .tcard-disabled {
      opacity: 0.25; cursor: not-allowed;
      filter: grayscale(0.6);
    }

    /* ---- Popular ---- */
    .popular { max-width: 900px; margin: 3rem auto 0; padding: 0 1.5rem; }
    .popular-heading {
      text-align: center; font-size: 0.75rem; text-transform: uppercase;
      letter-spacing: 1.2px; color: var(--text-muted);
      margin-bottom: 1rem;
      font-weight: 700;
    }
    .popular-list { display: flex; justify-content: center; gap: 0.65rem; flex-wrap: wrap; }
    .pop-chip {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--surface-1);
      border: 1px solid var(--border-soft);
      padding: 0.55rem 1.2rem; border-radius: 999px;
      color: var(--text-color); cursor: pointer; font-size: 0.88rem;
      font-weight: 500;
      box-shadow: 0 1px 2px rgba(15,23,42,0.04);
      transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease, background 0.22s ease;
    }
    .pop-chip:hover {
      border-color: color-mix(in srgb, var(--tunisia-red) 35%, var(--border-soft));
      background: color-mix(in srgb, var(--tunisia-red) 5%, var(--surface-1));
      transform: translateY(-2px);
      box-shadow: var(--shadow-card);
    }
    .pop-icon-img {
      display: block;
      width: 1.2rem;
      height: 1.2rem;
      object-fit: contain;
      transform-origin: center;
    }
    .pop-icon-bus { transform: translateY(1px); }
    .pop-icon-plane { transform: translateY(-1px); }
    .pop-arrow { font-size: 0.6rem; opacity: 0.3; transition: all 0.2s; margin-left: 0.2rem; }
    .pop-chip:hover .pop-arrow { opacity: 1; transform: translateX(3px); }

    .intl-flights-btn {
      position: fixed;
      left: 1rem;
      bottom: 1.25rem;
      z-index: 40;
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.65rem 1.1rem;
      border-radius: 999px;
      border: 1px solid var(--border-soft);
      background: var(--surface-1);
      color: var(--text-color);
      cursor: pointer;
      box-shadow: var(--shadow-card);
      font-size: 0.88rem;
      font-weight: 600;
      transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }
    .intl-flights-btn:hover {
      border-color: color-mix(in srgb, var(--tunisia-red) 55%, var(--border-soft));
      color: var(--tunisia-red);
      transform: translateY(-2px);
    }
    .intl-flights-btn-icon {
      width: 1.25rem;
      height: 1.25rem;
      object-fit: contain;
      flex-shrink: 0;
    }

    /* ---- Responsive ---- */
    @media (max-width: 768px) {
      .hero-title { font-size: 2rem; }
      .search-bar { flex-direction: column; border-radius: 20px; }
      .sb-divider { width: 100%; height: 1px; margin: 0; }
      .sb-swap { align-self: center; margin: -0.6rem 0; }
      .sb-pax {
        flex: 1 1 auto;
        max-width: none;
        width: 100%;
        padding-right: 1.125rem;
      }
      .sb-pax .sb-inner {
        align-items: center;
      }
      .sb-pax-shell {
        margin-inline: auto;
      }
      .types-grid { grid-template-columns: repeat(2, 1fr); }

      .intl-flights-btn {
        left: 0.65rem;
        bottom: calc(1rem + env(safe-area-inset-bottom));
        padding: 0.55rem 0.85rem;
        font-size: 0.82rem;
      }
    }
  `]
})
export class TransportSearchPageComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private store = inject(TripContextStore);
  private dataSource = inject(DATA_SOURCE_TOKEN);
  private cdr = inject(ChangeDetectorRef);
  private alerts = inject(AppAlertsService);
  private cityMatch = inject(TunisiaCityMatchService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private subs = new Subscription();

  cities = signal<City[]>([]);
  today = new Date();

  fromCityId = signal<number | null>(null);
  toCityId = signal<number | null>(null);

  searchForm = this.fb.group({
    from: [null as number | null, Validators.required],
    to: [null as number | null, Validators.required],
    date: [null as Date | null, Validators.required],
    passengers: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
  });

  hasBothCities = computed(() => !!this.fromCityId() && !!this.toCityId());

  typeCards = computed<TypeCard[]>(() => {
    void this.language.currentLang();
    const fromId = this.fromCityId();
    const toId = this.toCityId();
    const fromCity = this.cities().find(c => c.id === fromId);
    const toCity = this.cities().find(c => c.id === toId);

    return VISIBLE_TYPES.map(type => {
      const meta = TRANSPORT_TYPE_META[type];
      let available = true;
      let reason: string | undefined;

      if (fromCity && toCity) {
        const fromHasInfra = this.citySupportsInfra(fromCity, meta.requiresFrom);
        if (meta.requiresFrom && !fromHasInfra) {
          available = false;
          reason = this.translate.instant('TRANSPORT_SEARCH.REASON_NO_INFRA', {
            infra: this.translate.instant('TRANSPORT.INFRA.' + meta.requiresFrom),
            city: fromCity.name,
          });
        }
        const toHasInfra = this.citySupportsInfra(toCity, meta.requiresTo);
        if (available && meta.requiresTo && !toHasInfra) {
          available = false;
          reason = this.translate.instant('TRANSPORT_SEARCH.REASON_NO_INFRA', {
            infra: this.translate.instant('TRANSPORT.INFRA.' + meta.requiresTo),
            city: toCity.name,
          });
        }
      } else {
        available = false;
      }

      return {
        type,
        labelKey: `TRANSPORT.TYPE.${type}`,
        iconPath: this.iconFor(type),
        available,
        reason,
      };
    });
  });

  popularRoutes = [
    { fromId: 1, toId: 3, type: 'BUS', labelKey: 'TRANSPORT_SEARCH.POP_TUNIS_SOUSSE', icon: '/icones/autobus.png' },
    { fromId: 1, toId: 8, type: 'PLANE', labelKey: 'TRANSPORT_SEARCH.POP_TUNIS_DJERBA', icon: '/icones/avion.png' },
    { fromId: 3, toId: 5, type: 'TAXI', labelKey: 'TRANSPORT_SEARCH.POP_SOUSSE_HAMMAMET', icon: '/icones/taxi.png' },
    { fromId: 1, toId: 4, type: 'CAR', labelKey: 'TRANSPORT_SEARCH.POP_TUNIS_SFAX', icon: '/icones/car.png' },
  ];

  ngOnInit() {
    const qp = this.route.snapshot.queryParams;

    this.loadCities(qp, true);

    this.subs.add(
      this.language.langChanged$.pipe(skip(1)).subscribe(() => {
        this.loadCities(this.route.snapshot.queryParams, false);
      })
    );

    const leg = this.store.transportSearchLeg();

    if (qp['date']) {
      this.searchForm.patchValue({ date: new Date(qp['date']) });
    } else if (leg.travelDateIso) {
      this.searchForm.patchValue({ date: new Date(leg.travelDateIso) });
    } else if (this.store.dates().travelDate) {
      this.searchForm.patchValue({ date: new Date(this.store.dates().travelDate!) });
    }

    const pax = qp['passengers']
      ? Number(qp['passengers'])
      : leg.passengers >= 1
        ? leg.passengers
        : this.store.pax().adults;
    this.searchForm.patchValue({ passengers: pax });

    this.subs.add(
      this.searchForm.get('from')!.valueChanges.subscribe(v => {
        this.fromCityId.set(v);
        this.cdr.markForCheck();
      })
    );
    this.subs.add(
      this.searchForm.get('to')!.valueChanges.subscribe(v => {
        this.toCityId.set(v);
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.searchForm.valueChanges.subscribe(() => this.syncTransportSearchLegFromForm()),
    );
  }

  /**
   * Reloads city labels from the API (honours {@code lang} via HTTP interceptor).
   * @param runGeo when true, may auto-pick nearest city from browser geolocation (first load only).
   */
  private loadCities(qp: Record<string, string | undefined>, runGeo: boolean): void {
    const preserveFrom = this.searchForm.get('from')?.value as number | null | undefined;
    const preserveTo = this.searchForm.get('to')?.value as number | null | undefined;

    this.dataSource.getCities().subscribe((data) => {
      this.cities.set(data);
      this.cdr.markForCheck();

      if (runGeo && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void this.cityMatch
              .reverseGeocodeThenNearestCity(pos.coords.latitude, pos.coords.longitude, data)
              .then((match) => {
                if (!match || qp['from']) {
                  return;
                }
                this.searchForm.patchValue({ from: match.id });
                this.fromCityId.set(match.id);
                this.cdr.markForCheck();
              });
          },
          () => {
            /* denied */
          },
          { maximumAge: 120_000, timeout: 15_000, enableHighAccuracy: false }
        );
      }

      const legSnap = this.store.transportSearchLeg();

      if (runGeo) {
        if (qp['from']) {
          const fromId = Number(qp['from']);
          this.searchForm.patchValue({ from: fromId });
          this.fromCityId.set(fromId);
        } else if (legSnap.fromCityId != null) {
          this.searchForm.patchValue({ from: legSnap.fromCityId });
          this.fromCityId.set(legSnap.fromCityId);
        } else {
          const current = data.find((c) => c.id === this.store.selectedCityId());
          if (current) {
            this.searchForm.patchValue({ from: current.id });
            this.fromCityId.set(current.id);
          }
        }

        if (qp['to']) {
          const toId = Number(qp['to']);
          this.searchForm.patchValue({ to: toId });
          this.toCityId.set(toId);
        } else if (legSnap.toCityId != null) {
          this.searchForm.patchValue({ to: legSnap.toCityId });
          this.toCityId.set(legSnap.toCityId);
        }
      } else {
        if (preserveFrom != null) {
          this.searchForm.patchValue({ from: preserveFrom });
          this.fromCityId.set(preserveFrom);
        }
        if (preserveTo != null) {
          this.searchForm.patchValue({ to: preserveTo });
          this.toCityId.set(preserveTo);
        }
      }

      this.cdr.markForCheck();
      this.syncTransportSearchLegFromForm();
    });
  }

  /** Persists Départ / Arrivée / Date / Pax for `/transport/flights` hydration. */
  syncTransportSearchLegFromForm(): void {
    const v = this.searchForm.getRawValue();
    const dateStr = v.date ? this.travelDateTimeLocalIso(v.date) : null;
    this.store.setTransportSearchLeg({
      fromCityId: v.from ?? null,
      toCityId: v.to ?? null,
      travelDateIso: dateStr,
      passengers: Math.max(1, Math.min(20, v.passengers ?? 1)),
    });
  }

  /** Worldwide → Tunisia airports (standalone international flight search). */
  navigateInternationalFlights(): void {
    const v = this.searchForm.getRawValue();
    const toCity = this.cityById(v.to ?? null);
    const destIata = tunisiaAirportIataForCity(toCity) ?? 'TUN';
    const dateStr = v.date ? this.travelDateTimeLocalIso(v.date) : '';
    const passengers = Math.max(1, Math.min(9, v.passengers ?? 1));
    const q: Record<string, string | number> = { to: destIata };
    if (dateStr) {
      q['date'] = dateStr;
    }
    q['passengers'] = passengers;
    void this.router.navigate(['/flights/international'], { queryParams: q });
  }

  cityById(id: number | null): City | null {
    if (id == null) {
      return null;
    }
    return this.cities().find((c) => c.id === id) ?? null;
  }

  onRouteSummary(ev: { distanceKm: number; durationSeconds: number }): void {
    this.store.setTransportRouteMetrics(ev.distanceKm, ev.durationSeconds);
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  onTypeClick(card: TypeCard) {
    if (!card.available) return;
    if (!this.validateSearchBusinessRules()) {
      return;
    }
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_CHECK_SEARCH'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_CHECK_SEARCH_BODY'),
      );
      return;
    }

    const v = this.searchForm.value;
    const dateStr = v.date ? this.travelDateTimeLocalIso(v.date) : '';
    this.store.setDates({ travelDate: dateStr });
    this.store.setPax({ adults: v.passengers ?? 1, children: 0 });

    if (card.type === 'PLANE') {
      const fromCity = this.cityById(v.from ?? null);
      const toCity = this.cityById(v.to ?? null);
      this.router.navigate(['/transport/flights'], {
        queryParams: this.buildFlightQueryParams(fromCity, toCity, dateStr, v.passengers ?? 1),
      });
      return;
    }

    this.router.navigate(['/transport/results'], {
      queryParams: { from: v.from, to: v.to, date: dateStr, transportType: card.type, passengers: v.passengers }
    });
  }

  swapCities() {
    const f = this.searchForm.get('from')!.value;
    const t = this.searchForm.get('to')!.value;
    this.searchForm.patchValue({ from: t, to: f });
  }

  quickSearch(route: { fromId: number; toId: number; type: string; labelKey: string }) {
    if (route.fromId === route.toId) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_INVALID_ROUTE'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_SAME_CITY'),
      );
      return;
    }
    this.searchForm.patchValue({ from: route.fromId, to: route.toId });
    const dateVal = this.searchForm.get('date')?.value ?? new Date();
    if (!this.isDateNotInPast(dateVal)) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_INVALID_DATE'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_PAST_DATE'),
      );
      return;
    }
    const dateStr = this.travelDateTimeLocalIso(dateVal);
    this.store.setDates({ travelDate: dateStr });
    this.store.setPax({ adults: this.searchForm.get('passengers')?.value ?? 1, children: 0 });

    if ((route.type ?? '').toUpperCase() === 'PLANE') {
      const fromCity = this.cityById(route.fromId);
      const toCity = this.cityById(route.toId);
      this.router.navigate(['/transport/flights'], {
        queryParams: this.buildFlightQueryParams(fromCity, toCity, dateStr, this.searchForm.get('passengers')?.value ?? 1),
      });
      return;
    }

    this.router.navigate(['/transport/results'], {
      queryParams: { from: route.fromId, to: route.toId, date: dateStr, transportType: route.type, passengers: this.searchForm.get('passengers')?.value ?? 1 }
    });
  }

  private buildFlightQueryParams(fromCity: City | null, toCity: City | null, dateStr: string, passengers: number): Record<string, string | number> {
    const destination = toCity?.name?.trim() || this.resolveAirportIata(toCity) || 'Djerba';
    const origin = this.resolveAirportIata(fromCity) || 'TUN';
    return {
      destination,
      origin,
      date: dateStr,
      passengers,
      from: fromCity?.id ?? '',
      to: toCity?.id ?? '',
      transportType: 'PLANE',
    };
  }

  private citySupportsInfra(city: City, infra: keyof CityInfrastructure | null): boolean {
    if (!infra) {
      return true;
    }
    if (infra === 'airport') {
      return !!city.stations?.airport || !!this.resolveAirportIata(city);
    }
    return !!city.stations?.[infra as keyof NonNullable<City['stations']>];
  }

  private resolveAirportIata(city: City | null): string | null {
    return tunisiaAirportIataForCity(city);
  }

  private iconFor(type: TransportType): string {
    const map: Record<string, string> = {
      BUS: '/icones/autobus.png',
      TAXI: '/icones/taxi.png',
      CAR: '/icones/car.png',
      PLANE: '/icones/avion.png',
    };
    return map[type] ?? '';
  }

  /** Local `YYYY-MM-DDTHH:mm:ss` for store, URL, and booking (Twilio-friendly). */
  private travelDateTimeLocalIso(date: Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day}T${h}:${mi}:${s}`;
  }

  /** Business rules before navigating to results. */
  private validateSearchBusinessRules(): boolean {
    const v = this.searchForm.getRawValue();
    if (v.from == null || v.to == null || !v.date) {
      this.searchForm.markAllAsTouched();
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_INCOMPLETE'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_INCOMPLETE_BODY'),
      );
      return false;
    }
    if (v.from === v.to) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_INVALID_ROUTE'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_SAME_CITIES'),
      );
      return false;
    }
    if (!this.isDateNotInPast(v.date)) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_INVALID_DATE'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_PAST_DATE'),
      );
      return false;
    }
    const p = v.passengers ?? 1;
    if (p < 1 || p > 20) {
      void this.alerts.warning(
        this.translate.instant('TRANSPORT_SEARCH.ALERT_PASSENGERS'),
        this.translate.instant('TRANSPORT_SEARCH.ALERT_PASSENGERS_BODY'),
      );
      return false;
    }
    return true;
  }

  private isDateNotInPast(d: Date): boolean {
    const now = Date.now();
    const slackMs = 60_000;
    return d.getTime() >= now - slackMs;
  }
}
