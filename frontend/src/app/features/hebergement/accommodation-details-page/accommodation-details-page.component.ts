import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePickerModule } from 'primeng/datepicker';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Accommodation } from '../../../core/models/travel.models';
import { ExploreService } from '../../../explore/explore.service';
import { PublicReview, ReviewSummary } from '../../../explore/explore.models';
import { AuthService } from '../../../core/auth.service';
import { CurrencyService } from '../../../core/services/currency.service';
import {
  AccommodationRoomCategory,
  nightlyRateForCategory,
  quoteRoomId,
  suiteEligible,
} from '../../../core/utils/accommodation-quote.util';
import { createCurrencyDisplaySyncEffect } from '../../../core/utils/currency-display-sync';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Swal from 'sweetalert2';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, DatePickerModule, TranslateModule],
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
                @for (amenity of amenityList(acc); track amenity) {
                  <div class="highlight"><i class="pi pi-check-circle hl-pi" aria-hidden="true"></i><span>{{ amenity }}</span></div>
                }
                @if (amenityList(acc).length === 0) {
                  <div class="highlight"><i class="pi pi-info-circle hl-pi" aria-hidden="true"></i><span>{{ 'Highlights not available yet' }}</span></div>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="card">
              <h3>{{ 'ACCOMM.ABOUT_TITLE' | translate }}</h3>
              <p class="desc-text">{{ aboutText(acc) }}</p>
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
                  <div class="room-price">{{ formatTnd(roomNightly(acc, 'SINGLE')) }} <span class="room-per-night">{{ 'ACCOMM.PER_NIGHT' | translate }}</span></div>
                </div>
                <div class="room-item" [class.selected]="store.accommodationRoomCategory() === 'DOUBLE'" (click)="selectRoom('DOUBLE')">
                  <div class="room-icon" aria-hidden="true"><i class="pi pi-users"></i></div>
                  <div class="room-info">
                    <strong>{{ 'ACCOMM.ROOM_DOUBLE' | translate }}</strong>
                    <span>{{ 'ACCOMM.ROOM_DOUBLE_DESC' | translate }}</span>
                  </div>
                  <div class="room-price">{{ formatTnd(roomNightly(acc, 'DOUBLE')) }} <span class="room-per-night">{{ 'ACCOMM.PER_NIGHT' | translate }}</span></div>
                </div>
                @if (eligibleSuite(acc)) {
                  <div class="room-item suite" [class.selected]="store.accommodationRoomCategory() === 'SUITE'" (click)="selectRoom('SUITE')">
                    <div class="room-icon" aria-hidden="true"><i class="pi pi-star-fill"></i></div>
                    <div class="room-info">
                      <strong>{{ 'ACCOMM.ROOM_SUITE' | translate }}</strong>
                      <span>{{ 'ACCOMM.ROOM_SUITE_DESC' | translate }}</span>
                    </div>
                    <div class="room-price">{{ formatTnd(roomNightly(acc, 'SUITE')) }} <span class="room-per-night">{{ 'ACCOMM.PER_NIGHT' | translate }}</span></div>
                  </div>
                }
              </div>
            </div>

            <div class="card review-card">
              <div class="review-head">
                <h3>{{ 'Guest reviews & comments' }}</h3>
                <p>{{ 'Same experience as restaurants: ratings, comments, edit and delete your own review.' }}</p>
              </div>

              <div class="review-summary-line">
                <div class="review-stars" [attr.aria-label]="'Average rating'">
                  @for (state of starStates(ratingValue()); track $index) {
                    <span [class.filled]="state === 'full'">★</span>
                  }
                </div>
                <strong>{{ ratingValue() | number:'1.1-1' }}/5</strong>
                <small>{{ reviewSummary().totalReviews }} review(s)</small>
              </div>

              <div class="reviews-list">
                @if (reviews().length === 0) {
                  <p class="empty">No comments yet for this property.</p>
                } @else {
                  @for (review of reviews(); track review.reviewId) {
                    <article class="review-item">
                      <div class="review-top">
                        <div class="review-author">
                          @if (review.profileImageUrl) {
                            <img class="review-avatar" [src]="review.profileImageUrl" alt="Reviewer profile" />
                          } @else {
                            <span class="review-avatar review-avatar-fallback">{{ reviewAuthorInitial(review) }}</span>
                          }
                          <div class="review-meta">
                            <strong>{{ reviewAuthorEmail(review) }}</strong>
                            <small>{{ review.username }}</small>
                          </div>
                        </div>
                        <div class="review-right">
                          <div class="review-stars compact" aria-label="review stars">
                            @for (state of starStates(review.stars); track $index) {
                              <span [class.filled]="state === 'full'">★</span>
                            }
                          </div>
                          @if (isOwnReview(review)) {
                            <div class="review-actions">
                              <button type="button" class="mini-btn" (click)="startEditReview(review)" [disabled]="reviewSubmitting()">Edit</button>
                              <button type="button" class="mini-btn danger" (click)="deleteOwnReview()" [disabled]="reviewSubmitting()">Delete</button>
                            </div>
                          }
                        </div>
                      </div>
                      <p>{{ review.commentText }}</p>
                    </article>
                  }
                }
              </div>

              <form class="review-form" (ngSubmit)="submitReview()">
                <label>
                  Your rating
                  <div class="review-stars selectable">
                    @for (star of [1,2,3,4,5]; track star) {
                      <button type="button" class="star-btn" [class.filled]="reviewForm.stars >= star" (click)="setReviewStars(star)">★</button>
                    }
                  </div>
                </label>

                <label>
                  Your comment
                  <textarea rows="4" [(ngModel)]="reviewForm.commentText" name="accommodationReviewComment" placeholder="Share your accommodation experience..." maxlength="1500"></textarea>
                </label>

                <div class="review-form-tools">
                  <details class="emoji-details">
                    <summary class="emoji-trigger">😀 Emoji picker</summary>
                    <section class="emoji-panel" aria-label="Emoji picker panel">
                      <div class="emoji-grid" aria-label="Emoji options">
                        @for (emoji of commentEmojis; track emoji) {
                          <button type="button" class="emoji-cell" (click)="appendEmoji(emoji)">{{ emoji }}</button>
                        }
                      </div>
                    </section>
                  </details>
                  <small class="review-char-count">{{ reviewForm.commentText.length }}/1500</small>
                </div>

                <button class="btn-book" type="submit" [disabled]="reviewSubmitting() || !reviewForm.commentText.trim()">
                  {{ reviewSubmitting() ? 'Sending...' : (editingReviewId() ? 'Save changes' : 'Post comment') }}
                </button>

                @if (editingReviewId()) {
                  <button class="mini-btn" type="button" (click)="cancelEditReview()" [disabled]="reviewSubmitting()">Cancel edit</button>
                }
              </form>
            </div>
          </div>

          <!-- Right: Booking Widget -->
          <div class="booking-widget">
            <div class="widget-card">
              <div class="widget-price">
                <span class="price-widget-main">{{ formatTnd(effectiveNightly()) }}</span>
                @if (formatApprox(effectiveNightly()); as approxNightly) {
                  <span class="price-widget-approx">{{ approxNightly }}</span>
                }
                <span class="price-unit"><small>{{ 'ACCOMM.PER_NIGHT' | translate }}</small></span>
              </div>
              <div class="rating-small">{{ getStars(acc.rating) }} {{ acc.rating }}/5</div>

              <hr class="divider">

              <!-- Date Pickers -->
              <form [formGroup]="dateForm" class="date-form">
                <div class="date-row">
                  <div class="date-field">
                    <label><i class="pi pi-calendar widget-label-pi" aria-hidden="true"></i> {{ 'ACCOMM.CHECK_IN' | translate }}</label>
                    <p-datepicker
                      formControlName="checkIn"
                      [minDate]="today"
                      dateFormat="dd/mm/yy"
                      [showIcon]="false"
                      [readonlyInput]="true"
                      [appendTo]="'body'"
                      [showButtonBar]="true"
                      styleClass="acc-date-picker"
                      panelStyleClass="acc-date-panel"
                      [placeholder]="'Select date'"
                      inputId="accommodationCheckIn"
                    ></p-datepicker>
                  </div>
                  <div class="date-field">
                    <label><i class="pi pi-calendar widget-label-pi" aria-hidden="true"></i> {{ 'ACCOMM.CHECK_OUT' | translate }}</label>
                    <p-datepicker
                      formControlName="checkOut"
                      [minDate]="tomorrow"
                      dateFormat="dd/mm/yy"
                      [showIcon]="false"
                      [readonlyInput]="true"
                      [appendTo]="'body'"
                      [showButtonBar]="true"
                      styleClass="acc-date-picker"
                      panelStyleClass="acc-date-panel"
                      [placeholder]="'Select date'"
                      inputId="accommodationCheckOut"
                    ></p-datepicker>
                  </div>
                </div>

              </form>

              <!-- Price Breakdown -->
              @if (nightCount() > 0) {
                <div class="price-breakdown">
                  <div class="breakdown-row">
                    <span class="breakdown-label">{{ formatTnd(effectiveNightly()) }} {{ 'ACCOMM.X_NIGHTS' | translate: { n: nightCount() } }}</span>
                    <span class="price-amount">{{ formatTnd(totalPrice()) }}</span>
                  </div>
                  <div class="breakdown-row">
                    <span class="breakdown-label">{{ 'ACCOMM.TAXES_FEES' | translate }}</span>
                    <span class="price-amount">{{ formatTnd(taxAmount()) }}</span>
                  </div>
                  <hr class="divider">
                  <div class="breakdown-row total-row">
                    <strong>{{ 'ACCOMM.TOTAL' | translate }}</strong>
                    <div class="total-price-wrap">
                      <strong class="total-price">{{ formatTnd(grandTotal()) }}</strong>
                      @if (formatApprox(grandTotal()); as approxTotal) {
                        <small class="total-approx">{{ approxTotal }}</small>
                      }
                    </div>
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
    .price-widget-main { font-size: 1.25rem; font-weight: 800; color: var(--text-color); line-height: 1.2; white-space: nowrap; }
    .price-widget-approx { font-size: 0.84rem; color: var(--text-muted); line-height: 1.1; }
    .room-per-night { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .price-unit { color: var(--text-muted); }
    .rating-small { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem; }
    .divider { border: none; border-top: 1px solid var(--border-soft); margin: 1.5rem 0; }

    /* Date Form */
    .date-form { margin-bottom: 1rem; }
    .date-row { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 10px; }
    .date-field, .pax-field { display: flex; flex-direction: column; gap: 6px; }
    .date-field label, .pax-field label { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .widget-label-pi { font-size: 0.95rem; color: var(--tunisia-red); opacity: 0.9; }
    select {
      background: var(--input-bg); border: 1px solid var(--border-soft); border-radius: 10px;
      padding: 10px 12px; color: var(--text-color); font-size: 0.95rem; outline: none; width: 100%;
      cursor: pointer; appearance: none; transition: border-color 0.2s;
    }
    select:focus { border-color: var(--tunisia-red); }
    select option { background: var(--surface-1); color: var(--text-color); }

    :host ::ng-deep .acc-date-picker {
      width: 100%;
      display: block;
    }
    :host ::ng-deep .acc-date-picker .p-datepicker-input,
    :host ::ng-deep .acc-date-picker .p-inputtext {
      width: 100%;
      height: 50px;
      border-radius: 12px;
      border: 1px solid var(--border-soft);
      background: var(--input-bg);
      color: var(--text-color);
      font-size: 0.96rem;
      font-weight: 600;
      padding: 0 0.9rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box;
    }
    :host ::ng-deep .acc-date-picker .p-datepicker-input:focus,
    :host ::ng-deep .acc-date-picker .p-inputtext:focus {
      border-color: var(--tunisia-red);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--tunisia-red) 20%, transparent);
    }
    :host ::ng-deep .acc-date-picker .p-datepicker,
    :host ::ng-deep .acc-date-picker .p-component,
    :host ::ng-deep .acc-date-picker .p-inputwrapper {
      width: 100%;
      display: block;
    }
    :host ::ng-deep .acc-date-picker .p-inputtext::placeholder,
    :host ::ng-deep .acc-date-picker .p-datepicker-input::placeholder {
      color: var(--text-muted);
      opacity: 0.9;
    }
    :host ::ng-deep .acc-date-panel {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.24);
    }

    /* Price Breakdown */
    .price-breakdown { background: var(--surface-2); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
    .breakdown-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted); }
    .breakdown-label { color: var(--text-muted); }
    .price-amount { color: var(--text-color); font-weight: 700; white-space: nowrap; }
    .total-row { margin-top: 4px; }
    .total-price-wrap { display: flex; flex-direction: column; align-items: flex-end; }
    .total-price { color: var(--tunisia-red); font-size: 1.75rem; line-height: 1.1; white-space: nowrap; }
    .total-approx { color: var(--text-muted); font-size: 0.82rem; white-space: nowrap; }

    /* Reviews */
    .review-card { display: grid; gap: 14px; }
    .review-head h3 { margin: 0; }
    .review-head p { margin: 6px 0 0; color: var(--text-muted); }
    .review-summary-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .review-summary-line small { color: var(--text-muted); }
    .review-stars { display: inline-flex; gap: 4px; font-size: 1rem; color: #d4d4d8; }
    .review-stars span.filled, .star-btn.filled { color: #f59e0b; }
    .reviews-list { display: grid; gap: 10px; }
    .review-item { background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 12px; padding: 10px 12px; }
    .review-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .review-author { display: inline-flex; align-items: center; gap: 10px; }
    .review-avatar { width: 34px; height: 34px; border-radius: 999px; object-fit: cover; border: 1px solid var(--border-soft); background: var(--surface-1); }
    .review-avatar-fallback { display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: var(--text-color); }
    .review-meta { display: grid; gap: 2px; }
    .review-meta strong { color: var(--text-color); font-size: 0.92rem; }
    .review-meta small { color: var(--text-muted); }
    .review-right { display: grid; justify-items: end; gap: 6px; }
    .review-actions { display: inline-flex; gap: 6px; }
    .review-item p { margin: 8px 0 0; color: var(--text-muted); }
    .review-form { display: grid; gap: 10px; }
    .review-form label { display: grid; gap: 6px; color: var(--text-color); }
    .review-form textarea {
      background: var(--surface-2);
      border: 1px solid var(--border-soft);
      border-radius: 12px;
      color: var(--text-color);
      padding: 10px 12px;
      resize: vertical;
      min-height: 90px;
    }
    .review-form-tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      position: relative;
    }
    .review-char-count { color: var(--text-muted); font-size: 0.8rem; }
    .emoji-trigger {
      border: 1px solid var(--border-soft);
      border-radius: 10px;
      padding: 7px 11px;
      background: var(--surface-2);
      color: var(--text-color);
      cursor: pointer;
      font-size: 0.86rem;
    }
    .emoji-panel {
      position: absolute;
      z-index: 1505;
      top: 38px;
      left: 0;
      width: min(360px, 90vw);
      border: 1px solid var(--border-soft);
      border-radius: 12px;
      background: var(--surface-1);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25);
      padding: 10px;
      display: grid;
      gap: 8px;
    }
    .emoji-grid {
      max-height: 220px;
      overflow: auto;
      display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      gap: 6px;
    }
    .emoji-cell {
      width: 100%;
      height: 30px;
      border: 1px solid var(--border-soft);
      border-radius: 8px;
      background: var(--surface-2);
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
    }
    .review-stars.selectable { gap: 6px; }
    .star-btn {
      background: transparent;
      border: 0;
      color: #d4d4d8;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
      padding: 0;
    }
    .mini-btn {
      border: 1px solid var(--border-soft);
      border-radius: 10px;
      background: var(--surface-1);
      color: var(--text-color);
      padding: 7px 10px;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .mini-btn.danger { color: #c81e31; border-color: #fecdd3; background: #fff1f2; }
    .mini-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .empty { color: var(--text-muted); margin: 0 0 10px; }

    /* CTA */
    .btn-book { width: 100%; padding: 16px; background: var(--tunisia-red); color: #fff; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px var(--tunisia-red-glow); }
    .btn-book:hover:not([disabled]) { filter: brightness(1.06); transform: translateY(-2px); box-shadow: 0 6px 20px var(--tunisia-red-glow); }
    .btn-book[disabled] { opacity: 0.4; cursor: not-allowed; }
    .no-charge { display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; font-size: 0.82rem; color: var(--text-muted); margin-top: 1rem; margin-bottom: 0; }
    .no-charge-pi { color: #2ecc71; font-size: 1rem; }

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
  exploreService = inject(ExploreService);
  authService = inject(AuthService);
  currency = inject(CurrencyService);
  fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  accommodation = signal<Accommodation | null>(null);
  loading = signal(true);
  reviewSummary = signal<ReviewSummary>({ averageStars: 0, totalReviews: 0 });
  reviews = signal<PublicReview[]>([]);
  reviewSubmitting = signal(false);
  editingReviewId = signal<number | null>(null);
  reviewPage = 0;
  readonly reviewSize = 6;
  readonly commentEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜',
    '🤪', '🤗', '😎', '🥳', '😌', '😢', '😭', '😡', '😱', '😷', '🤒', '🤢', '👍', '👎', '👌', '✌️', '🤟', '🤘',
    '🤙', '👏', '🙌', '🙏', '💪', '👋', '🤝', '☝️', '👇', '👉', '👈', '✈️', '🧳', '🗺️', '🏝️', '🚗', '🚕', '🚌',
    '🚆', '⛵', '🚤', '🍽️', '☕', '🍵', '🥤', '🍕', '🍔', '🌮', '🥙', '🍟', '🍜', '🍝', '🍣', '🥗', '🥘', '🍲',
    '🍛', '🍰', '🍩', '🍎', '🍉', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '✅', '❌', '⚠️', '⭐',
    '🔥', '✨', '💬', '📍', '📸'
  ];
  reviewForm = {
    stars: 5,
    commentText: '',
  };
  /** Bumps when the date form changes so night-based computeds stay fresh (OnPush). */
  private formRevision = signal(0);

  today = new Date();
  tomorrow = new Date(Date.now() + 86400000);

  dateForm = this.fb.group({
    checkIn: [this.parseStoredDate(this.store.dates().checkIn) ?? this.today, Validators.required],
    checkOut: [this.parseStoredDate(this.store.dates().checkOut) ?? this.tomorrow, Validators.required],
  });

  nightCount = computed(() => {
    this.formRevision();
    const ci = this.toDateOnly(this.dateForm.get('checkIn')?.value);
    const co = this.toDateOnly(this.dateForm.get('checkOut')?.value);
    if (!ci || !co) return 0;
    const diff = co.getTime() - ci.getTime();
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
    });
    this.formRevision.update((v) => v + 1);

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.dataSource.getAccommodationDetails(id).subscribe({
        next: (data) => {
          this.accommodation.set(data);
          this.store.selectedAccommodation.set(data);
          this.initPricingForProperty(data);
          this.loadReviewSummary();
          this.loadReviews();
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  eligibleSuite(acc: Accommodation): boolean {
    return suiteEligible(acc);
  }

  roomNightly(acc: Accommodation, cat: AccommodationRoomCategory): number {
    return nightlyRateForCategory(acc, cat);
  }

  /** After load, align category + quote with the property's available room options. */
  private initPricingForProperty(acc: Accommodation): void {
    let cat = this.store.accommodationRoomCategory();
    if (cat === 'SUITE' && !suiteEligible(acc)) {
      cat = 'DOUBLE';
    }
    this.store.setAccommodationRoomQuote(cat, quoteRoomId(acc, cat));
    this.formRevision.update((v) => v + 1);
  }

  selectRoom(type: AccommodationRoomCategory): void {
    const acc = this.accommodation();
    if (!acc) return;
    if (type === 'SUITE' && !suiteEligible(acc)) return;
    this.store.setAccommodationRoomQuote(type, quoteRoomId(acc, type));
    this.formRevision.update((v) => v + 1);
    document.querySelector('.booking-widget')?.scrollIntoView({ behavior: 'smooth' });
  }

  onBook() {
    const ci = this.formatDateForApi(this.dateForm.value.checkIn);
    const co = this.formatDateForApi(this.dateForm.value.checkOut);
    if (!ci || !co) {
      return;
    }
    const acc = this.accommodation();

    this.store.setDates({ checkIn: ci, checkOut: co });
    this.store.setPax({ adults: 1, children: 0 });
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

  ratingValue(): number {
    return this.reviewSummary().averageStars || 0;
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
    this.reviewForm = {
      stars: review.stars,
      commentText: review.commentText,
    };
  }

  cancelEditReview(): void {
    this.editingReviewId.set(null);
    this.reviewForm = {
      stars: 5,
      commentText: '',
    };
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
    const accommodationId = this.accommodation()?.id;
    if (!accommodationId || !this.reviewForm.commentText.trim()) {
      return;
    }

    this.reviewSubmitting.set(true);
    this.exploreService.createOrUpdateAccommodationReview(accommodationId, {
      stars: this.reviewForm.stars,
      commentText: this.reviewForm.commentText.trim(),
    }).subscribe({
      next: () => {
        this.reviewSubmitting.set(false);
        this.cancelEditReview();
        this.loadReviewSummary();
        this.loadReviews();
      },
      error: (err: HttpErrorResponse) => {
        this.reviewSubmitting.set(false);
        if (err?.status === 401) {
          Swal.fire({
            icon: 'warning',
            title: 'Sign in required',
            text: 'Please sign in to post your review.',
            confirmButtonColor: '#e63946',
          });
          return;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'Unable to publish comment.',
          confirmButtonColor: '#e63946',
        });
      },
    });
  }

  deleteOwnReview(): void {
    const accommodationId = this.accommodation()?.id;
    if (!accommodationId) {
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: 'Delete your comment?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.reviewSubmitting.set(true);
      this.exploreService.deleteAccommodationReviewMine(accommodationId).subscribe({
        next: () => {
          this.reviewSubmitting.set(false);
          this.cancelEditReview();
          this.loadReviewSummary();
          this.loadReviews();
        },
        error: (err: HttpErrorResponse) => {
          this.reviewSubmitting.set(false);
          if (err?.status === 401) {
            Swal.fire({
              icon: 'warning',
              title: 'Sign in required',
              text: 'Please sign in to manage your comment.',
              confirmButtonColor: '#e63946',
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || 'Unable to delete comment.',
            confirmButtonColor: '#e63946',
          });
        },
      });
    });
  }

  private loadReviewSummary(): void {
    const accommodationId = this.accommodation()?.id;
    if (!accommodationId) {
      return;
    }

    this.exploreService.getAccommodationReviewSummary(accommodationId).subscribe({
      next: (summary) => {
        this.reviewSummary.set(summary);
      },
      error: () => {
        this.reviewSummary.set({ averageStars: 0, totalReviews: 0 });
      },
    });
  }

  private loadReviews(): void {
    const accommodationId = this.accommodation()?.id;
    if (!accommodationId) {
      return;
    }

    this.exploreService.listAccommodationReviews(accommodationId, this.reviewPage, this.reviewSize).subscribe({
      next: (payload) => {
        this.reviewSummary.set(payload.summary);
        this.reviews.set(payload.reviews.content);
      },
      error: () => {
        this.reviews.set([]);
      },
    });
  }

  amenityList(acc: Accommodation): string[] {
    return (acc.amenities ?? [])
      .map((a) => a?.trim())
      .filter((a): a is string => !!a);
  }

  aboutText(acc: Accommodation): string {
    const text = acc.description?.trim();
    if (text) {
      return text;
    }
    return 'Description not available yet.';
  }

  getHotelImage(acc: Accommodation): string {
    // Generate a deterministic Unsplash image based on city and type
    const keywords = ['hotel', acc.cityName || 'tunisia', 'luxury'];
    const seed = acc.id || 1;
    return `https://source.unsplash.com/1200x600/?${keywords.join(',')}&sig=${seed}`;
  }

  formatTnd(amount: number): string {
    const normalized = Number.isFinite(amount) ? amount : 0;
    return `${new Intl.NumberFormat(undefined, {
      minimumFractionDigits: normalized % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(normalized)} TND`;
  }

  formatApprox(amountTnd: number): string | null {
    const code = this.currency.selectedCode();
    if (code === 'TND') {
      return null;
    }
    const rate = this.currency.rateFor(code);
    if (rate == null) {
      return null;
    }

    const converted = Math.round(amountTnd * rate * 100) / 100;
    const symbol = code === 'EUR' ? '€' : '$';
    return `~ ${new Intl.NumberFormat(undefined, {
      minimumFractionDigits: converted % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(converted)} ${symbol}`;
  }

  private parseStoredDate(value: string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toDateOnly(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDateForApi(value: unknown): string | null {
    const date = this.toDateOnly(value);
    if (!date) {
      return null;
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
