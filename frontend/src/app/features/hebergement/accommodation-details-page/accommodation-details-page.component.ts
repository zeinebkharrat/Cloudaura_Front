import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Accommodation } from '../../../core/models/travel.models';
import {
  AccommodationRoomCategory,
  maxGuestsForCategory,
  maxSelectableGuests,
  minCategoryForGuests,
  nightlyRateForCategory,
  quoteRoomId,
  suiteEligible,
} from '../../../core/utils/accommodation-quote.util';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    @if (loading()) {
      <div class="loader-page">
        <div class="spinner-large"></div>
        <p>Loading accommodation…</p>
      </div>
    }

    @if (accommodation(); as acc) {
      <div class="page-wrap">

        <!-- Hero Image Banner -->
        <div class="hero-banner" [style.background-image]="'url(' + getHotelImage(acc) + ')'">
          <div class="hero-overlay">
            <div class="hero-top">
              <button class="btn-back" (click)="router.navigate(['/hebergement'])">
                ← Back to listings
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
                  <span>{{ acc.cityName }}, Tunisia</span>
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
              <h3 class="hl-title"><img src="icones/hotel.png" alt="" class="hl-title-ico" width="22" height="22" /> Highlights</h3>
              <div class="highlights-grid">
                <div class="highlight"><i class="pi pi-sun hl-pi" aria-hidden="true"></i><span>Air conditioning</span></div>
                <div class="highlight"><i class="pi pi-shopping-bag hl-pi" aria-hidden="true"></i><span>Breakfast included</span></div>
                <div class="highlight"><i class="pi pi-car hl-pi" aria-hidden="true"></i><span>Free parking</span></div>
                <div class="highlight"><i class="pi pi-clock hl-pi" aria-hidden="true"></i><span>24/7 service</span></div>
                <div class="highlight"><i class="pi pi-wifi hl-pi" aria-hidden="true"></i><span>Wi‑Fi included</span></div>
                <div class="highlight"><i class="pi pi-users hl-pi" aria-hidden="true"></i><span>Accessible (PRM)</span></div>
                @if (acc.rating >= 4) {
                  <div class="highlight"><i class="pi pi-database hl-pi" aria-hidden="true"></i><span>Pool</span></div>
                  <div class="highlight"><i class="pi pi-sparkles hl-pi" aria-hidden="true"></i><span>Spa &amp; wellness</span></div>
                }
              </div>
            </div>

            <!-- Description -->
            <div class="card">
              <h3>About this property</h3>
              <p class="desc-text">
                Welcome to <strong>{{ acc.name }}</strong>, in the heart of <strong>{{ acc.cityName }}</strong>.
                This standout property blends modern comfort with authentic Tunisian charm.
                Enjoy quality services and a great base to explore the region.
              </p>
              <p class="desc-text">
                With a <strong>{{ acc.rating }}/5</strong> rating, guests highlight warm hospitality,
                spotless rooms, and great amenities.
              </p>
            </div>

            <!-- Rooms Available -->
            <div class="card">
              <h3 class="rooms-title"><i class="pi pi-home rooms-title-pi" aria-hidden="true"></i> Available rooms</h3>
              <div class="rooms-list">
                <div class="room-item" [class.selected]="store.accommodationRoomCategory() === 'SINGLE'" (click)="selectRoom('SINGLE')">
                  <div class="room-icon" aria-hidden="true"><i class="pi pi-user"></i></div>
                  <div class="room-info">
                    <strong>Single room</strong>
                    <span>1 guest · Garden view</span>
                  </div>
                  <div class="room-price">{{ roomNightly(acc, 'SINGLE') | number:'1.0-0' }} TND / night</div>
                </div>
                <div class="room-item" [class.selected]="store.accommodationRoomCategory() === 'DOUBLE'" (click)="selectRoom('DOUBLE')">
                  <div class="room-icon" aria-hidden="true"><i class="pi pi-users"></i></div>
                  <div class="room-info">
                    <strong>Double room</strong>
                    <span>2 guests · Sea view available</span>
                  </div>
                  <div class="room-price">{{ roomNightly(acc, 'DOUBLE') | number:'1.0-0' }} TND / night</div>
                </div>
                @if (eligibleSuite(acc)) {
                  <div class="room-item suite" [class.selected]="store.accommodationRoomCategory() === 'SUITE'" (click)="selectRoom('SUITE')">
                    <div class="room-icon" aria-hidden="true"><i class="pi pi-star-fill"></i></div>
                    <div class="room-info">
                      <strong>Luxury suite</strong>
                      <span>4 guests · Terrace · Panoramic view</span>
                    </div>
                    <div class="room-price">{{ roomNightly(acc, 'SUITE') | number:'1.0-0' }} TND / night</div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Right: Booking Widget -->
          <div class="booking-widget">
            <div class="widget-card">
              <div class="widget-price">
                <span class="price-big">{{ effectiveNightly() | number:'1.0-0' }}</span>
                <span class="price-unit">TND / night</span>
              </div>
              <div class="rating-small">{{ getStars(acc.rating) }} {{ acc.rating }}/5</div>

              <hr class="divider">

              <!-- Date Pickers -->
              <form [formGroup]="dateForm" class="date-form">
                <div class="date-row">
                  <div class="date-field">
                    <label><i class="pi pi-calendar widget-label-pi" aria-hidden="true"></i> Check-in</label>
                    <input type="date" formControlName="checkIn" [min]="today">
                  </div>
                  <div class="date-field">
                    <label><i class="pi pi-calendar widget-label-pi" aria-hidden="true"></i> Check-out</label>
                    <input type="date" formControlName="checkOut" [min]="tomorrow">
                  </div>
                </div>

                <div class="pax-field">
                  <label><i class="pi pi-users widget-label-pi" aria-hidden="true"></i> Guests</label>
                  <select formControlName="guests">
                    @for (i of guestOptions(); track i) {
                      <option [value]="i">{{ i }} guest(s)</option>
                    }
                  </select>
                </div>
              </form>

              <!-- Price Breakdown -->
              @if (nightCount() > 0) {
                <div class="price-breakdown">
                  <div class="breakdown-row">
                    <span>{{ effectiveNightly() | number:'1.0-0' }} TND × {{ nightCount() }} night(s)</span>
                    <span>{{ totalPrice() | number:'1.0-0' }} TND</span>
                  </div>
                  <div class="breakdown-row">
                    <span>Taxes &amp; fees</span>
                    <span>{{ taxAmount() | number:'1.0-0' }} TND</span>
                  </div>
                  <hr class="divider">
                  <div class="breakdown-row total-row">
                    <strong>Total</strong>
                    <strong class="total-price">{{ grandTotal() | number:'1.0-0' }} TND</strong>
                  </div>
                </div>
              }

              <button class="btn-book" (click)="onBook()"
                      [disabled]="dateForm.invalid || nightCount() <= 0">
                Book now
              </button>

              <p class="no-charge"><i class="pi pi-check-circle no-charge-pi" aria-hidden="true"></i> Free cancellation · No hidden fees</p>
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
    .widget-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .price-big { font-size: 2.2rem; font-weight: 800; color: var(--text-color); }
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
    .breakdown-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted); }
    .total-row { margin-top: 4px; }
    .total-price { color: var(--tunisia-red); font-size: 1.3rem; }

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
  route = inject(ActivatedRoute);
  router = inject(Router);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);
  fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  accommodation = signal<Accommodation | null>(null);
  loading = signal(true);
  /** Bumps when the date/guest form changes so night-based computeds stay fresh (OnPush). */
  private formRevision = signal(0);

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
    const map: Record<string, string> = {
      HOTEL: 'Hotel',
      MAISON_HOTE: 'Guest house',
      GUESTHOUSE: 'Rural guesthouse',
      AUTRE: 'Stay',
    };
    return map[type] || type;
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
    // Generate a deterministic Unsplash image based on city and type
    const keywords = ['hotel', acc.cityName || 'tunisia', 'luxury'];
    const seed = acc.id || 1;
    return `https://source.unsplash.com/1200x600/?${keywords.join(',')}&sig=${seed}`;
  }
}
