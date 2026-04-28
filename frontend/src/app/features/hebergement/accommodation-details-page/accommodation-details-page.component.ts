import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Accommodation } from '../../../core/models/travel.models';
import { ExploreService } from '../../../explore/explore.service';
import { PublicReview, ReviewSummary } from '../../../explore/explore.models';
import { AuthService } from '../../../core/auth.service';
import {
  AccommodationRoomCategory,
  maxGuestsForCategory,
  maxSelectableGuests,
  minCategoryForGuests,
  nightlyRateForCategory,
  quoteRoomId,
  suiteEligible,
} from '../../../core/utils/accommodation-quote.util';
import { DualCurrencyPipe } from '../../../core/pipes/dual-currency.pipe';
import { createCurrencyDisplaySyncEffect } from '../../../core/utils/currency-display-sync';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

const HOTEL_IMAGE_MAP: Record<string, string> = {
  'concorde hotel tunis': 'Concorde Hotel Tunis.jpg',
  'el mouradi palace': 'El Mouradi Palace.jpg',
  'four seasons hotel tunis': 'four-seasons-hotel-tunis.jpg',
  'four seasons hotel': 'four-seasons-hotel-tunis.jpg',
  'golden tulip carthage tunis': 'Golden Tulip Carthage Tunis.jpg',
  'golden tulip carthage': 'Golden Tulip Carthage Tunis.jpg',
  'hasdrubal prestige ariana': 'Hasdrubal Prestige Ariana.webp',
  'hasdrubal prestige': 'Hasdrubal Prestige Ariana.webp',
  'iberostar averroes': 'Iberostar Averroes.jpg',
  'la badira': 'la badira_hammamet.jpg',
  'la badira hammamet': 'la badira_hammamet.jpg',
  'laico tunis': 'Laico Tunis.jpg',
  'movenpick tunis': 'movenpick_tunis.jpg',
  'movenpick hotel du lac tunis': 'movenpick_tunis.jpg',
  'radisson blu tunis airport': 'Radisson Blu Tunis Airport.avif',
  'radisson blu': 'Radisson Blu Tunis Airport.avif',
  'sheraton tunis': 'Sheraton Tunis.jpg',
  'the residence tunis': 'The_Residence_Tunis.jpg'
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, DualCurrencyPipe, TranslateModule],
  template: `
    @if (loading()) {
      <div class="loader-page">
        <div class="spinner-large"></div>
        <p>{{ 'ACCOMM.LOADING_DETAILS' | translate }}</p>
      </div>
    }

    @if (accommodation(); as acc) {
      <div class="page-wrap">

        <!-- Hero Image Banner -->
        <div class="hero-banner" [style.background-image]="'url(' + getHotelImage(acc) + ')'">
          <div class="hero-overlay">
            <div class="hero-top">
              <button class="btn-back" (click)="router.navigate(['/hebergement'])">
                {{ 'ACCOMM.BACK_LISTINGS' | translate }}
              </button>
              <div class="hero-badges">
                <span class="badge-type">
                  <img [src]="typeIconSrc(acc.type)" alt="" class="badge-type-ico" width="16" height="16" />
                  {{ formatType(acc.type) }}
                </span>
              </div>
            </div>
            <div class="hero-bottom">
              <div>
                <h1>{{ acc.name }}</h1>
                <div class="location-row">
                  <img src="icones/city.png" alt="" class="loc-icon-img" width="18" height="18" />
                  <span>{{ acc.cityName }}, {{ 'ACCOMM.COUNTRY' | translate }}</span>
                </div>
              </div>
              <div class="rating-big">
                <div class="stars">{{ getStars(acc.rating) }}</div>
                <div class="score">{{ acc.rating }}/5</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content + Booking Panel -->
        <div class="content-grid">

          <!-- Left: Details -->
          <div class="details-section">

            <!-- Quick Highlights -->
            <div class="card highlights-card">
              <h3 class="hl-title"><img src="icones/hotel.png" alt="" class="hl-title-ico" width="22" height="22" /> {{ 'ACCOMM.HIGHLIGHTS_TITLE' | translate }}</h3>
              <div class="highlights-grid">
                <div class="highlight"><i class="pi pi-sun hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_AIR_CON' | translate }}</span></div>
                <div class="highlight"><i class="pi pi-shopping-bag hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_BREAKFAST' | translate }}</span></div>
                <div class="highlight"><i class="pi pi-car hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_PARKING' | translate }}</span></div>
                <div class="highlight"><i class="pi pi-clock hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_SERVICE_247' | translate }}</span></div>
                <div class="highlight"><i class="pi pi-wifi hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_WIFI' | translate }}</span></div>
                <div class="highlight"><i class="pi pi-users hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_ACCESSIBLE' | translate }}</span></div>
                @if (acc.rating >= 4) {
                  <div class="highlight"><i class="pi pi-database hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_POOL' | translate }}</span></div>
                  <div class="highlight"><i class="pi pi-sparkles hl-pi" aria-hidden="true"></i><span>{{ 'ACCOMM.HL_SPA' | translate }}</span></div>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="card">
              <h3>{{ 'ACCOMM.ABOUT_TITLE' | translate }}</h3>
              <p class="desc-text">{{ 'ACCOMM.ABOUT_L1' | translate: { name: acc.name, city: acc.cityName } }}</p>
              <p class="desc-text">{{ 'ACCOMM.ABOUT_L2' | translate }}</p>
              <p class="desc-text">{{ 'ACCOMM.ABOUT_L3' | translate: { rating: acc.rating } }}</p>
            </div>

            <!-- Rooms Available -->
            <div class="card">
              <h3 class="rooms-title"><i class="pi pi-home rooms-title-pi" aria-hidden="true"></i> {{ 'ACCOMM.ROOMS_TITLE' | translate }}</h3>
              <div class="rooms-list">
                <div class="room-item" [class.selected]="store.accommodationRoomCategory() === 'SINGLE'" (click)="selectRoom('SINGLE')">
                  <div class="room-icon" aria-hidden="true"><i class="pi pi-user"></i></div>
                  <div class="room-info">
                    <strong>{{ 'ACCOMM.ROOM_SINGLE' | translate }}</strong>
                    <span>{{ 'ACCOMM.ROOM_SINGLE_DESC' | translate }}</span>
                  </div>
                  <div class="room-price">{{ roomNightly(acc, 'SINGLE') | number: '1.0-2' }} TND <span class="room-per-night">{{ 'ACCOMM.PER_NIGHT' | translate }}</span></div>
                </div>
                <div class="room-item" [class.selected]="store.accommodationRoomCategory() === 'DOUBLE'" (click)="selectRoom('DOUBLE')">
                  <div class="room-icon" aria-hidden="true"><i class="pi pi-users"></i></div>
                  <div class="room-info">
                    <strong>{{ 'ACCOMM.ROOM_DOUBLE' | translate }}</strong>
                    <span>{{ 'ACCOMM.ROOM_DOUBLE_DESC' | translate }}</span>
                  </div>
                  <div class="room-price">{{ roomNightly(acc, 'DOUBLE') | number: '1.0-2' }} TND <span class="room-per-night">{{ 'ACCOMM.PER_NIGHT' | translate }}</span></div>
                </div>
                @if (eligibleSuite(acc)) {
                  <div class="room-item suite" [class.selected]="store.accommodationRoomCategory() === 'SUITE'" (click)="selectRoom('SUITE')">
                    <div class="room-icon" aria-hidden="true"><i class="pi pi-star-fill"></i></div>
                    <div class="room-info">
                      <strong>{{ 'ACCOMM.ROOM_SUITE' | translate }}</strong>
                      <span>{{ 'ACCOMM.ROOM_SUITE_DESC' | translate }}</span>
                    </div>
                    <div class="room-price">{{ roomNightly(acc, 'SUITE') | number: '1.0-2' }} TND <span class="room-per-night">{{ 'ACCOMM.PER_NIGHT' | translate }}</span></div>
                  </div>
                }
              </div>
            </div>

            <!-- User reviews (same flow as explore restaurant) -->
            <div class="card acc-reviews">
              <h3 class="acc-reviews-title">
                <i class="pi pi-comments acc-reviews-title-pi" aria-hidden="true"></i>
                {{ 'EXPLORE_RESTAURANT.REVIEWS_TITLE' | translate }}
              </h3>
              <p class="acc-reviews-sub">{{ 'EXPLORE_RESTAURANT.REVIEWS_SUB' | translate }}</p>
              @if (reviewSummarySig().totalReviews > 0) {
                <p class="acc-reviews-count">{{ 'EXPLORE_RESTAURANT.REVIEWS_COUNT' | translate: { n: reviewSummarySig().totalReviews } }}</p>
              }

              <div class="acc-reviews-list">
                @if (reviews().length === 0) {
                  <p class="acc-reviews-empty">{{ 'EXPLORE_RESTAURANT.NO_COMMENTS' | translate }}</p>
                } @else {
                  @for (review of reviews(); track review.reviewId) {
                    <article class="acc-review-item">
                      <div class="acc-review-top">
                        <div class="acc-review-author">
                          @if (review.profileImageUrl) {
                            <img class="acc-review-avatar" [src]="review.profileImageUrl" [alt]="'EXPLORE_RESTAURANT.REVIEWER_ALT' | translate" />
                          } @else {
                            <span class="acc-review-avatar acc-review-avatar-fallback">{{ reviewAuthorInitial(review) }}</span>
                          }
                          <div class="acc-review-meta">
                            <strong>{{ reviewAuthorEmail(review) }}</strong>
                            <small>{{ review.username }}</small>
                          </div>
                        </div>
                        <div class="acc-review-right">
                          <div class="rv-stars rv-stars-compact" [attr.aria-label]="'EXPLORE_RESTAURANT.REVIEW_STARS_A11Y' | translate">
                            @for (state of starStates(review.stars); track $index) {
                              <span [class.filled]="state === 'full'">★</span>
                            }
                          </div>
                          @if (isOwnReview(review)) {
                            <div class="acc-review-actions">
                              <button type="button" class="acc-mini-btn" (click)="startEditReview(review)" [disabled]="reviewSubmitting()">
                                {{ 'EXPLORE_RESTAURANT.EDIT' | translate }}
                              </button>
                              <button type="button" class="acc-mini-btn acc-mini-btn-danger" (click)="deleteOwnReview()" [disabled]="reviewSubmitting()">
                                {{ 'EXPLORE_RESTAURANT.DELETE' | translate }}
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                      <p class="acc-review-body">{{ review.commentText }}</p>
                    </article>
                  }
                }
              </div>

              <form class="acc-review-form" (ngSubmit)="submitReview()">
                <label class="acc-review-label">
                  {{ 'EXPLORE_RESTAURANT.YOUR_RATING' | translate }}
                  <div class="rv-stars rv-stars-selectable">
                    @for (star of [1,2,3,4,5]; track star) {
                      <button type="button" class="rv-star-btn" [class.filled]="reviewForm.stars >= star" (click)="setReviewStars(star)">★</button>
                    }
                  </div>
                </label>
                <label class="acc-review-label">
                  {{ 'EXPLORE_RESTAURANT.YOUR_COMMENT' | translate }}
                  <textarea
                    rows="4"
                    [(ngModel)]="reviewForm.commentText"
                    name="reviewComment"
                    [placeholder]="'EXPLORE_RESTAURANT.COMMENT_PH' | translate"
                    maxlength="1500"
                  ></textarea>
                </label>
                <div class="acc-review-form-tools">
                  <details class="acc-emoji-details">
                    <summary class="acc-emoji-trigger" [attr.aria-label]="'EXPLORE_RESTAURANT.EMOJI_A11Y' | translate">😀 Emoji picker</summary>
                    <section class="acc-emoji-panel">
                      <div class="acc-emoji-grid">
                        @for (
                          emoji of ['😀','😃','😄','😁','😆','😅','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😋','😜','🤪','🤗','😎','🥳','😌','😢','😭','😡','😱','😷','🤒','🤢','👍','👎','👌','✌️','🤟','🤘','🤙','👏','🙌','🙏','💪','👋','🤝','☝️','👇','👉','👈','✈️','🧳','🗺️','🏝️','🚗','🚕','🚌','🚆','⛵','🚤','🍽️','☕','🍵','🥤','🍕','🍔','🌮','🥙','🍟','🍜','🍝','🍣','🥗','🥘','🍲','🍛','🍰','🍩','🍎','🍉','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','✅','❌','⚠️','⭐','🔥','✨','💬','📍','📸'];
                          track emoji
                        ) {
                          <button type="button" class="acc-emoji-cell" (click)="appendEmoji(emoji)">{{ emoji }}</button>
                        }
                      </div>
                    </section>
                  </details>
                  <small class="acc-review-char-count">{{ reviewForm.commentText.length }}/1500</small>
                </div>
                <button
                  class="btn-book acc-review-submit"
                  type="submit"
                  [disabled]="reviewSubmitting() || !reviewForm.commentText.trim()"
                >
                  {{
                    reviewSubmitting()
                      ? ('EXPLORE_RESTAURANT.SENDING' | translate)
                      : (editingReviewId() ? ('EXPLORE_RESTAURANT.SAVE_CHANGES' | translate) : ('EXPLORE_RESTAURANT.POST_COMMENT' | translate))
                  }}
                </button>
                @if (editingReviewId()) {
                  <button type="button" class="acc-mini-btn acc-cancel-edit" (click)="cancelEditReview()" [disabled]="reviewSubmitting()">
                    {{ 'EXPLORE_RESTAURANT.CANCEL_EDIT' | translate }}
                  </button>
                }
              </form>
            </div>
          </div>

          <!-- Right: Booking Widget -->
          <div class="booking-widget">
            <div class="widget-card">
              <div class="widget-price">
                <span class="price-widget-dual">{{ effectiveNightly() | number: '1.0-2' }} TND</span>
                <span class="price-unit"><small>{{ 'ACCOMM.PER_NIGHT' | translate }}</small></span>
              </div>
              <div class="rating-small">{{ getStars(acc.rating) }} {{ acc.rating }}/5</div>

              <hr class="divider">

              <!-- Date Pickers -->
              <form [formGroup]="dateForm" class="date-form">
                <div class="date-row">
                  <div class="date-field">
                    <label><i class="pi pi-calendar widget-label-pi" aria-hidden="true"></i> {{ 'ACCOMM.CHECK_IN' | translate }}</label>
                    <input type="date" formControlName="checkIn" [min]="today">
                  </div>
                  <div class="date-field">
                    <label><i class="pi pi-calendar widget-label-pi" aria-hidden="true"></i> {{ 'ACCOMM.CHECK_OUT' | translate }}</label>
                    <input type="date" formControlName="checkOut" [min]="tomorrow">
                  </div>
                </div>

                <div class="pax-field">
                  <label><i class="pi pi-users widget-label-pi" aria-hidden="true"></i> {{ 'ACCOMM.GUESTS' | translate }}</label>
                  <select formControlName="guests">
                    @for (i of guestOptions(); track i) {
                      <option [value]="i">{{ 'ACCOMM.GUESTS_OPTION' | translate: { n: i } }}</option>
                    }
                  </select>
                </div>
              </form>

              <!-- Price Breakdown -->
              @if (nightCount() > 0) {
                <div class="price-breakdown">
                  <div class="breakdown-row">
                    <span>{{ effectiveNightly() | number: '1.0-2' }} TND {{ 'ACCOMM.X_NIGHTS' | translate: { n: nightCount() } }}</span>
                    <span>{{ totalPrice() | number: '1.0-2' }} TND</span>
                  </div>
                  <hr class="divider">
                  <div class="breakdown-row total-row">
                    <strong>{{ 'ACCOMM.TOTAL' | translate }}</strong>
                    <strong class="total-price">{{ grandTotal() | dualCurrency }}</strong>
                  </div>
                </div>
              }

              <button class="btn-book" (click)="onBook()"
                      [disabled]="dateForm.invalid || nightCount() <= 0">
                {{ 'ACCOMM.BOOK_NOW' | translate }}
              </button>

              <p class="no-charge"><i class="pi pi-check-circle no-charge-pi" aria-hidden="true"></i> {{ 'ACCOMM.TRUST_BADGE' | translate }}</p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Loader */
    .loader-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 1rem; color: var(--text-muted); }
    .spinner-large { width: 50px; height: 50px; border: 4px solid color-mix(in srgb, var(--tunisia-red) 22%, transparent); border-top-color: var(--tunisia-red); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Hero */
    .hero-banner { min-height: 420px; background-size: cover; background-position: center; position: relative; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.75)); display: flex; flex-direction: column; justify-content: space-between; padding: 2rem; }
    .hero-top, .hero-bottom { display: flex; justify-content: space-between; align-items: flex-start; }
    .hero-bottom { align-items: flex-end; }
    .btn-back { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 20px; border-radius: 30px; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; }
    .btn-back:hover { background: rgba(255,255,255,0.25); }
    .badge-type { display: inline-flex; align-items: center; gap: 8px; background: var(--tunisia-red); color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.5px; }
    .badge-type-ico { object-fit: contain; flex-shrink: 0; }
    h1 { font-size: 2.8rem; font-weight: 800; color: #fff; margin: 0 0 0.5rem 0; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
    .location-row { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.85); font-size: 1.05rem; }
    .loc-icon-img { object-fit: contain; opacity: 0.9; flex-shrink: 0; }
    .rating-big { text-align: right; }
    .stars { font-size: 1.5rem; }
    .score { color: #f1c40f; font-size: 1.2rem; font-weight: 700; }

    /* Layout */
    .page-wrap { background: var(--bg-color); min-height: 100vh; color: var(--text-color); }
    .content-grid { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; padding: 2rem; max-width: 1300px; margin: 0 auto; }

    /* Cards */
    .card { background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 16px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-soft); }
    .card h3 { font-size: 1.2rem; color: var(--text-color); margin: 0 0 1.5rem 0; font-weight: 700; }

    /* Highlights */
    .hl-title { display: flex; align-items: center; gap: 10px; }
    .hl-title-ico { object-fit: contain; flex-shrink: 0; }
    .highlights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .highlight { display: flex; flex-direction: column; align-items: center; gap: 8px; background: var(--surface-2); border-radius: 10px; padding: 1rem; font-size: 0.85rem; color: var(--text-color); text-align: center; }
    .hl-pi { font-size: 1.35rem; color: var(--tunisia-red); opacity: 0.9; }
    .rooms-title { display: flex; align-items: center; gap: 10px; }
    .rooms-title-pi { color: var(--tunisia-red); opacity: 0.9; font-size: 1.1rem; }

    /* Description */
    .desc-text { color: var(--text-muted); line-height: 1.8; margin-bottom: 1rem; }

    /* Rooms */
    .rooms-list { display: flex; flex-direction: column; gap: 1rem; }
    .room-item { display: flex; align-items: center; gap: 1rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 12px; padding: 1rem 1.5rem; cursor: pointer; transition: all 0.2s; }
    .room-item:hover { border-color: rgba(241,37,69,0.4); background: rgba(241,37,69,0.05); }
    .room-item.selected { border-color: rgba(241,37,69,0.85); background: rgba(241,37,69,0.12); box-shadow: 0 0 0 1px rgba(241,37,69,0.35); }
    .room-item.suite { border-color: rgba(255,202,40,0.3); }
    .room-item.suite:hover { border-color: rgba(255,202,40,0.6); background: rgba(255,202,40,0.05); }
    .room-item.suite.selected { border-color: rgba(255,202,40,0.9); background: rgba(255,202,40,0.12); box-shadow: 0 0 0 1px rgba(255,202,40,0.45); }
    .room-icon { font-size: 1.75rem; color: var(--tunisia-red); display: flex; align-items: center; justify-content: center; width: 2.5rem; }
    .room-info { flex: 1; }
    .room-info strong { display: block; color: var(--text-color); margin-bottom: 2px; }
    .room-info span { font-size: 0.85rem; color: var(--text-muted); }
    .room-price { font-weight: 700; color: var(--tunisia-red); white-space: nowrap; }

    /* Booking Widget */
    .booking-widget { position: sticky; top: 100px; height: fit-content; }
    .widget-card { background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 20px; padding: 2rem; box-shadow: var(--shadow-card); }
    .widget-price { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-bottom: 4px; }
    .price-widget-dual { font-size: 1.05rem; font-weight: 800; color: var(--text-color); line-height: 1.3; max-width: 100%; }
    .room-per-night { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .price-unit { color: var(--text-muted); }
    .rating-small { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem; }
    .divider { border: none; border-top: 1px solid var(--border-soft); margin: 1.5rem 0; }

    /* Date Form */
    .date-form { margin-bottom: 1rem; }
    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .date-field, .pax-field { display: flex; flex-direction: column; gap: 6px; }
    .date-field label, .pax-field label { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .widget-label-pi { font-size: 0.95rem; color: var(--tunisia-red); opacity: 0.9; }
    input[type="date"], select {
      background: var(--input-bg); border: 1px solid var(--border-soft); border-radius: 10px;
      padding: 10px 12px; color: var(--text-color); font-size: 0.95rem; outline: none; width: 100%;
      cursor: pointer; appearance: none; transition: border-color 0.2s;
    }
    input[type="date"]:focus, select:focus { border-color: var(--tunisia-red); }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; }
    :host-context([data-theme="light"]) input[type="date"]::-webkit-calendar-picker-indicator { filter: none; opacity: 0.55; }
    select option { background: var(--surface-1); color: var(--text-color); }

    /* Price Breakdown */
    .price-breakdown { background: var(--surface-2); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
    .breakdown-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 0.85rem; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted); }
    .breakdown-row span:last-child,
    .breakdown-row strong:last-child { text-align: right; white-space: nowrap; }
    .total-row { margin-top: 4px; }
    .total-price { color: var(--tunisia-red); font-size: 1.3rem; line-height: 1.1; }

    /* CTA */
    .btn-book { width: 100%; padding: 16px; background: var(--tunisia-red); color: #fff; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px var(--tunisia-red-glow); }
    .btn-book:hover:not([disabled]) { filter: brightness(1.06); transform: translateY(-2px); box-shadow: 0 6px 20px var(--tunisia-red-glow); }
    .btn-book[disabled] { opacity: 0.4; cursor: not-allowed; }
    .no-charge { display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; font-size: 0.82rem; color: var(--text-muted); margin-top: 1rem; margin-bottom: 0; }
    .no-charge-pi { color: #2ecc71; font-size: 1rem; }

    /* User reviews (aligned with explore restaurant detail) */
    .acc-reviews-title { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; color: var(--text-color); margin: 0 0 0.35rem 0; font-weight: 700; }
    .acc-reviews-title-pi { color: var(--tunisia-red); opacity: 0.9; font-size: 1.1rem; }
    .acc-reviews-sub { color: var(--text-muted); margin: 0 0 0.35rem 0; line-height: 1.5; }
    .acc-reviews-count { color: var(--text-muted); font-size: 0.88rem; margin: 0 0 1rem 0; }
    .acc-reviews-list { display: grid; gap: 10px; margin-bottom: 1.25rem; }
    .acc-reviews-empty { color: var(--text-muted); margin: 0 0 1rem 0; }
    .acc-review-item {
      background: var(--surface-2);
      border: 1px solid var(--border-soft);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .acc-review-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .acc-review-author { display: inline-flex; align-items: center; gap: 10px; }
    .acc-review-avatar {
      width: 34px; height: 34px; border-radius: 999px; object-fit: cover;
      border: 1px solid var(--border-soft); background: var(--surface-1);
    }
    .acc-review-avatar-fallback {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 999px;
      border: 1px solid var(--border-soft); background: var(--surface-1);
      font-size: 0.8rem; font-weight: 700; color: var(--text-color);
    }
    .acc-review-meta { display: grid; gap: 2px; }
    .acc-review-meta strong { color: var(--text-color); font-size: 0.92rem; }
    .acc-review-meta small { color: var(--text-muted); }
    .acc-review-right { display: grid; justify-items: end; gap: 6px; }
    .acc-review-actions { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .acc-mini-btn {
      border: 1px solid var(--border-soft); border-radius: 10px; background: var(--surface-1);
      color: var(--text-color); padding: 7px 10px; cursor: pointer; font-size: 0.82rem; font-weight: 600;
    }
    .acc-mini-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .acc-mini-btn-danger { color: #c81e31; border-color: #fecdd3; background: #fff1f2; }
    .acc-review-body { margin: 8px 0 0; color: var(--text-muted); line-height: 1.45; }
    .rv-stars { display: inline-flex; gap: 4px; font-size: 1rem; color: #d4d4d8; }
    .rv-stars span.filled, .rv-star-btn.filled { color: #f59e0b; }
    .rv-stars-compact { font-size: 0.92rem; }
    .rv-stars-selectable { gap: 6px; }
    .rv-star-btn {
      background: transparent; border: 0; color: #d4d4d8; cursor: pointer;
      font-size: 1.2rem; line-height: 1; padding: 0;
    }
    .acc-review-form { display: grid; gap: 10px; }
    .acc-review-label { display: grid; gap: 6px; color: var(--text-color); font-size: 0.95rem; }
    .acc-review-form textarea {
      background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 12px;
      color: var(--text-color); padding: 10px 12px; resize: vertical; min-height: 96px;
    }
    .acc-review-form-tools { display: flex; align-items: center; justify-content: space-between; gap: 10px; position: relative; flex-wrap: wrap; }
    .acc-review-char-count { color: var(--text-muted); font-size: 0.8rem; }
    .acc-emoji-details { position: relative; }
    .acc-emoji-trigger {
      border: 1px solid var(--border-soft); border-radius: 10px; padding: 7px 11px;
      background: var(--surface-2); color: var(--text-color); cursor: pointer; font-size: 0.86rem; list-style: none;
    }
    .acc-emoji-trigger::-webkit-details-marker { display: none; }
    .acc-emoji-panel {
      position: absolute; z-index: 10; top: 38px; left: 0;
      width: min(360px, 90vw); border: 1px solid var(--border-soft); border-radius: 12px;
      background: var(--surface-1); box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25); padding: 10px;
    }
    .acc-emoji-grid {
      max-height: 220px; overflow: auto; display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px;
    }
    .acc-emoji-cell {
      width: 100%; height: 30px; border: 1px solid var(--border-soft); border-radius: 8px;
      background: var(--surface-2); cursor: pointer; font-size: 1rem; line-height: 1;
    }
    .acc-review-submit { margin-top: 4px; }
    .acc-cancel-edit { justify-self: start; margin-top: 2px; }

    /* Responsive */
    @media (max-width: 1000px) {
      .content-grid { grid-template-columns: 1fr; }
      .booking-widget { position: static; }
      .highlights-grid { grid-template-columns: repeat(2, 1fr); }
      h1 { font-size: 2rem; }
    }
  `]
})
export class AccommodationDetailsPageComponent implements OnInit {
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();

  route = inject(ActivatedRoute);
  router = inject(Router);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private exploreService = inject(ExploreService);
  private authService = inject(AuthService);

  accommodation = signal<Accommodation | null>(null);
  loading = signal(true);
  /** Bumps when the date/guest form changes so night-based computeds stay fresh (OnPush). */
  private formRevision = signal(0);

  reviews = signal<PublicReview[]>([]);
  reviewSummarySig = signal<ReviewSummary>({ averageStars: 0, totalReviews: 0 });
  reviewSubmitting = signal(false);
  editingReviewId = signal<number | null>(null);
  reviewForm: { stars: number; commentText: string } = { stars: 5, commentText: '' };
  private readonly reviewPage = 0;
  private readonly reviewSize = 6;

  today = new Date().toISOString().split('T')[0];
  tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  dateForm = this.fb.group({
    checkIn: [this.store.dates().checkIn || this.today, Validators.required],
    checkOut: [this.store.dates().checkOut || this.tomorrow, Validators.required],
    guests: [this.store.pax().adults || 2, Validators.required],
  });

  guestOptions = computed(() => {
    const acc = this.accommodation();
    if (!acc) {
      return [1, 2, 3, 4, 5, 6];
    }
    const n = maxSelectableGuests(acc);
    return Array.from({ length: n }, (_, i) => i + 1);
  });

  nightCount = computed(() => {
    this.formRevision();
    const ci = this.dateForm.get('checkIn')?.value;
    const co = this.dateForm.get('checkOut')?.value;
    if (!ci || !co) return 0;
    const diff = new Date(co).getTime() - new Date(ci).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  });

  effectiveNightly = computed(() => {
    this.formRevision();
    const acc = this.accommodation();
    if (!acc) return 0;
    return nightlyRateForCategory(acc, this.store.accommodationRoomCategory());
  });

  totalPrice = computed(() => this.effectiveNightly() * this.nightCount());
  taxAmount = computed(() => Math.round(this.totalPrice() * 0.1));
  grandTotal = computed(() => this.totalPrice() + this.taxAmount());

  ngOnInit() {
    this.dateForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formRevision.update((v) => v + 1);
      this.onFormGuestsChanged();
    });
    this.formRevision.update((v) => v + 1);

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.dataSource.getAccommodationDetails(id).subscribe({
        next: (data) => {
          this.accommodation.set(data);
          this.store.selectedAccommodation.set(data);
          this.initPricingForProperty(data);
          this.loadAccommodationReviewSummary(data.id);
          this.loadAccommodationReviews(data.id);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  starStates(value: number): Array<'full' | 'empty'> {
    return Array.from({ length: 5 }, (_, index) => (value >= index + 1 ? 'full' : 'empty'));
  }

  setReviewStars(stars: number): void {
    this.reviewForm.stars = stars;
  }

  appendEmoji(emoji: string): void {
    this.reviewForm.commentText = `${this.reviewForm.commentText}${emoji}`;
  }

  startEditReview(review: PublicReview): void {
    this.editingReviewId.set(review.reviewId);
    this.reviewForm = { stars: review.stars, commentText: review.commentText };
  }

  cancelEditReview(): void {
    this.editingReviewId.set(null);
    this.reviewForm = { stars: 5, commentText: '' };
  }

  isOwnReview(review: PublicReview): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return currentUserId != null && currentUserId === review.userId;
  }

  reviewAuthorEmail(review: PublicReview): string {
    return review.userEmail?.trim() || review.username;
  }

  reviewAuthorInitial(review: PublicReview): string {
    const source = this.reviewAuthorEmail(review).trim();
    return source ? source.charAt(0).toUpperCase() : '?';
  }

  submitReview(): void {
    const acc = this.accommodation();
    if (!acc || !this.reviewForm.commentText.trim()) {
      return;
    }

    this.reviewSubmitting.set(true);
    this.exploreService
      .createOrUpdateAccommodationReview(acc.id, {
        stars: this.reviewForm.stars,
        commentText: this.reviewForm.commentText.trim(),
      })
      .subscribe({
        next: () => {
          this.reviewSubmitting.set(false);
          this.cancelEditReview();
          this.loadAccommodationReviewSummary(acc.id);
          this.loadAccommodationReviews(acc.id);
        },
        error: (err: HttpErrorResponse) => {
          this.reviewSubmitting.set(false);
          if (err?.status === 401) {
            Swal.fire({
              icon: 'warning',
              title: this.translate.instant('EXPLORE_RESTAURANT.SWAL_SIGNIN_POST_TITLE'),
              text: this.translate.instant('EXPLORE_RESTAURANT.SWAL_SIGNIN_POST_TEXT'),
              confirmButtonColor: '#e63946',
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: this.translate.instant('EXPLORE_RESTAURANT.SWAL_ERROR_TITLE'),
            text: err?.error?.message || this.translate.instant('EXPLORE_RESTAURANT.SWAL_PUBLISH_ERR'),
            confirmButtonColor: '#e63946',
          });
        },
      });
  }

  deleteOwnReview(): void {
    const acc = this.accommodation();
    if (!acc) {
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: this.translate.instant('EXPLORE_RESTAURANT.SWAL_DELETE_TITLE'),
      text: this.translate.instant('EXPLORE_RESTAURANT.SWAL_DELETE_TEXT'),
      showCancelButton: true,
      confirmButtonText: this.translate.instant('EXPLORE_RESTAURANT.SWAL_DELETE_CONFIRM'),
      cancelButtonText: this.translate.instant('EXPLORE_RESTAURANT.SWAL_DELETE_CANCEL'),
      confirmButtonColor: '#e63946',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.reviewSubmitting.set(true);
      this.exploreService.deleteAccommodationReviewMine(acc.id).subscribe({
        next: () => {
          this.reviewSubmitting.set(false);
          this.cancelEditReview();
          this.loadAccommodationReviewSummary(acc.id);
          this.loadAccommodationReviews(acc.id);
        },
        error: (err: HttpErrorResponse) => {
          this.reviewSubmitting.set(false);
          if (err?.status === 401) {
            Swal.fire({
              icon: 'warning',
              title: this.translate.instant('EXPLORE_RESTAURANT.SWAL_SIGNIN_MANAGE_TITLE'),
              text: this.translate.instant('EXPLORE_RESTAURANT.SWAL_SIGNIN_MANAGE_TEXT'),
              confirmButtonColor: '#e63946',
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: this.translate.instant('EXPLORE_RESTAURANT.SWAL_ERROR_TITLE'),
            text: err?.error?.message || this.translate.instant('EXPLORE_RESTAURANT.SWAL_DELETE_ERR'),
            confirmButtonColor: '#e63946',
          });
        },
      });
    });
  }

  private loadAccommodationReviewSummary(accommodationId: number): void {
    this.exploreService.getAccommodationReviewSummary(accommodationId).subscribe({
      next: (summary) => this.reviewSummarySig.set(summary),
      error: () => this.reviewSummarySig.set({ averageStars: 0, totalReviews: 0 }),
    });
  }

  private loadAccommodationReviews(accommodationId: number): void {
    this.exploreService.listAccommodationReviews(accommodationId, this.reviewPage, this.reviewSize).subscribe({
      next: (payload) => {
        this.reviewSummarySig.set(payload.summary);
        this.reviews.set(payload.reviews.content);
      },
      error: () => this.reviews.set([]),
    });
  }

  eligibleSuite(acc: Accommodation): boolean {
    return suiteEligible(acc);
  }

  roomNightly(acc: Accommodation, cat: AccommodationRoomCategory): number {
    return nightlyRateForCategory(acc, cat);
  }

  /** After load or when guest count exceeds the selected room capacity, align category + quote. */
  private initPricingForProperty(acc: Accommodation): void {
    const maxG = maxSelectableGuests(acc);
    let g = Number(this.dateForm.get('guests')?.value) || this.store.pax().adults || 2;
    if (g > maxG) {
      g = maxG;
      this.dateForm.patchValue({ guests: g }, { emitEvent: false });
    }
    let cat = this.store.accommodationRoomCategory();
    if (cat === 'SUITE' && !suiteEligible(acc)) {
      cat = 'DOUBLE';
    }
    if (g > maxGuestsForCategory(cat, acc)) {
      cat = minCategoryForGuests(g, acc);
    }
    this.store.setAccommodationRoomQuote(cat, quoteRoomId(acc, cat));
    this.formRevision.update((v) => v + 1);
  }

  /** When guests change: cap to property max; upgrade room category if current room is too small. */
  private onFormGuestsChanged(): void {
    const acc = this.accommodation();
    if (!acc) return;
    const maxG = maxSelectableGuests(acc);
    let g = Number(this.dateForm.get('guests')?.value) || 1;
    if (g > maxG) {
      this.dateForm.patchValue({ guests: maxG }, { emitEvent: false });
      g = maxG;
    }
    const cat = this.store.accommodationRoomCategory();
    if (g > maxGuestsForCategory(cat, acc)) {
      const next = minCategoryForGuests(g, acc);
      this.store.setAccommodationRoomQuote(next, quoteRoomId(acc, next));
    }
  }

  selectRoom(type: AccommodationRoomCategory): void {
    const acc = this.accommodation();
    if (!acc) return;
    if (type === 'SUITE' && !suiteEligible(acc)) return;
    let g = Number(this.dateForm.get('guests')?.value) || 1;
    const cap = maxGuestsForCategory(type, acc);
    if (g > cap) {
      this.dateForm.patchValue({ guests: cap });
      g = cap;
    }
    this.store.setAccommodationRoomQuote(type, quoteRoomId(acc, type));
    this.formRevision.update((v) => v + 1);
    document.querySelector('.booking-widget')?.scrollIntoView({ behavior: 'smooth' });
  }

  onBook() {
    const ci = this.dateForm.value.checkIn!;
    const co = this.dateForm.value.checkOut!;
    const guests = this.dateForm.value.guests!;
    const acc = this.accommodation();

    this.store.setDates({ checkIn: ci, checkOut: co });
    this.store.setPax({ adults: Number(guests), children: 0 });
    if (acc) {
      const cat = this.store.accommodationRoomCategory();
      this.store.setAccommodationRoomQuote(cat, quoteRoomId(acc, cat));
    }

    const accId = acc?.id;
    this.router.navigate(['/hebergement', accId, 'book']);
  }

  formatType(type: string): string {
    const key = `ACCOMM.TYPE_${type}`;
    const t = this.translate.instant(key);
    return t !== key ? t : type;
  }

  typeIconSrc(type: string): string {
    if (type === 'HOTEL') return 'icones/hotel.png';
    return 'icones/home.png';
  }

  getStars(rating: number): string {
    const full = Math.floor(rating);
    return '★'.repeat(full) + (rating % 1 >= 0.5 ? '½' : '');
  }

  getHotelImage(acc: Accommodation): string {
    const raw = (acc.mainPhotoUrl || acc.imageUrl || '').trim();
    if (raw) return raw;

    const hotelName = (acc.name || '').toLowerCase().trim();
    for (const [key, filename] of Object.entries(HOTEL_IMAGE_MAP)) {
      if (hotelName.includes(key)) {
        return `assets/hotels_images/${filename.replace(/ /g, '%20')}`;
      }
    }

    return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';
  }
}
