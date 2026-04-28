import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Accommodation } from '../../../core/models/travel.models';
import { TranslateModule } from '@ngx-translate/core';
import { createCurrencyDisplaySyncEffect } from '../../../core/utils/currency-display-sync';

/** Curated hotel / resort photos (Unsplash) used when the API returns no photo. */
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
  selector: 'app-accommodation-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hotel-card" (click)="select.emit()">
      <div class="card-visual">
        @if (!coverFailed) {
          <img
            class="card-cover"
            [src]="coverImageUrl()"
            alt=""
            loading="lazy"
            decoding="async"
            (error)="onCoverError()"
          />
        } @else {
          <div class="card-cover-fallback" [style.background]="getGradient()"></div>
        }
        <div class="card-visual-overlay" aria-hidden="true"></div>
        <div class="visual-content">
          <span class="type-pill">
            <img class="type-pill-icon" [src]="typeIconSrc(accommodation.type)" alt="" width="18" height="18" />
            {{ ('HEBERG.TYPE.' + accommodation.type) | translate }}
          </span>
          <div class="visual-icon-wrap">
            <img class="visual-icon-img" [src]="typeIconSrc(accommodation.type)" alt="" />
          </div>
        </div>
        <div class="rating-badge" [class.excellent]="accommodation.rating >= 4.5"
             [class.good]="accommodation.rating >= 3.5 && accommodation.rating < 4.5">
          <span class="rating-stars">{{ getStars(accommodation.rating) }}</span>
          <span class="rating-num">{{ accommodation.rating }}</span>
        </div>
      </div>

      <!-- Content -->
      <div class="card-body">
        <h3 class="hotel-name">{{ accommodation.name }}</h3>
        
        <div class="location-row">
          <span class="loc-dot"></span>
          <span>{{ accommodation.cityName || ('HEBERG.LIST.HERO_TUNISIA' | translate) }}</span>
          <span class="region-tag" *ngIf="accommodation.cityRegion">{{ accommodation.cityRegion }}</span>
        </div>

        <!-- Quick amenities -->
        <div class="amenity-row">
          <span class="amenity-chip"><i class="pi pi-wifi amenity-pi" aria-hidden="true"></i> {{ 'HEBERG.CARD.WIFI' | translate }}</span>
          <span class="amenity-chip"><i class="pi pi-car amenity-pi" aria-hidden="true"></i> {{ 'HEBERG.CARD.PARKING' | translate }}</span>
          <span class="amenity-chip" *ngIf="accommodation.rating >= 4"><i class="pi pi-database amenity-pi" aria-hidden="true"></i> {{ 'HEBERG.CARD.POOL' | translate }}</span>
        </div>

        <!-- Footer -->
        <div class="card-footer">
          <div class="price-block">
            <span class="price-dual">{{ accommodation.pricePerNight | number: '1.0-2' }} TND</span>
            <span class="price-currency"><small>{{ 'HEBERG.CARD.NIGHT' | translate }}</small></span>
          </div>
          <button class="btn-voir">
            {{ 'HEBERG.CARD.VIEW' | translate }} <span class="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hotel-card {
      background: var(--surface-1);
      border: 1px solid var(--border-soft);
      border-radius: 18px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .hotel-card:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-card), 0 0 0 1px color-mix(in srgb, var(--tunisia-red) 22%, transparent);
      border-color: color-mix(in srgb, var(--tunisia-red) 35%, var(--border-soft));
    }

    /* Visual Area */
    .card-visual {
      height: 180px;
      position: relative;
      display: flex;
      overflow: hidden;
      background: #1a0a2e;
    }
    .card-cover {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }
    .card-cover-fallback {
      position: absolute;
      inset: 0;
      z-index: 0;
    }
    .card-visual-overlay {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, transparent 42%, rgba(0, 0, 0, 0.5) 100%);
    }
    .visual-content {
      position: absolute;
      inset: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 2;
    }
    .visual-icon-wrap {
      position: absolute;
      right: 12px;
      bottom: 8px;
      opacity: 0.2;
      pointer-events: none;
    }
    .visual-icon-img {
      width: 72px;
      height: 72px;
      object-fit: contain;
    }
    .type-pill-icon {
      vertical-align: middle;
      margin-right: 6px;
      object-fit: contain;
    }
    .type-pill {
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(10px);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      width: fit-content;
      letter-spacing: 0.3px;
    }
    .rating-badge {
      position: absolute;
      bottom: 12px;
      left: 16px;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 3;
    }
    .rating-badge.excellent { background: rgba(241,37,69,0.8); }
    .rating-badge.good { background: rgba(255,152,0,0.7); }
    .rating-stars { font-size: 0.85rem; }
    .rating-num { color: #fff; font-weight: 700; font-size: 0.9rem; }

    /* Body */
    .card-body {
      padding: 1.25rem 1.25rem 1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .hotel-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-color);
      margin: 0 0 8px 0;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .location-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    .loc-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--tunisia-red);
      flex-shrink: 0;
    }
    .region-tag {
      background: var(--surface-2);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    /* Amenities */
    .amenity-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .amenity-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.72rem;
      padding: 4px 8px;
      background: var(--surface-2);
      border: 1px solid var(--border-soft);
      border-radius: 6px;
      color: var(--text-muted);
    }
    .amenity-pi { font-size: 0.78rem; color: var(--tunisia-red); opacity: 0.9; }

    /* Footer */
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--border-soft);
    }
    .price-block { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; max-width: 100%; }
    .price-dual {
      font-size: 0.92rem;
      font-weight: 800;
      color: var(--text-color);
      line-height: 1.25;
      word-break: break-word;
    }
    .price-currency {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .price-currency small {
      font-size: 0.7rem;
    }
    .btn-voir {
      background: var(--tunisia-red);
      border: none;
      color: #fff;
      padding: 10px 18px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-voir:hover {
      filter: brightness(1.06);
      transform: translateX(2px);
      box-shadow: 0 4px 12px var(--tunisia-red-glow);
    }
    .arrow { transition: transform 0.2s; }
    .hotel-card:hover .arrow { transform: translateX(3px); }
  `]
})
export class AccommodationCardComponent implements OnChanges {
  private readonly _currencyDisplaySync = createCurrencyDisplaySyncEffect();

  @Input() accommodation!: Accommodation;
  @Output() select = new EventEmitter<void>();

  /** Set when remote image fails to load; falls back to gradient. */
  coverFailed = false;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accommodation']) {
      this.coverFailed = false;
    }
  }

  onCoverError(): void {
    this.coverFailed = true;
    this.cdr.markForCheck();
  }

  coverImageUrl(): string {
    const raw = (this.accommodation.mainPhotoUrl || this.accommodation.imageUrl || '').trim();
    if (raw) {
      return raw;
    }
    
    // Try to match hotel name to mapped image
    const hotelName = (this.accommodation.name || '').toLowerCase().trim();
    for (const [key, filename] of Object.entries(HOTEL_IMAGE_MAP)) {
      if (hotelName.includes(key)) {
        return `assets/hotels_images/${filename.replace(/ /g, '%20')}`;
      }
    }

    return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=75';
  }

  typeIconSrc(type: string): string {
    if (type === 'HOTEL') return 'icones/hotel.png';
    return 'icones/home.png';
  }

  getStars(rating: number): string {
    const full = Math.floor(rating);
    return '★'.repeat(full) + (rating % 1 >= 0.5 ? '½' : '');
  }

  getGradient(): string {
    const gradients: Record<string, string> = {
      'HOTEL': 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #0f2027 100%)',
      'MAISON_HOTE': 'linear-gradient(135deg, #1a2a0a 0%, #2d4b1b 50%, #0f2710 100%)',
      'GUESTHOUSE': 'linear-gradient(135deg, #2a1a0a 0%, #4b3b1b 50%, #271f0f 100%)',
      'AUTRE': 'linear-gradient(135deg, #0a1a2a 0%, #1b2d4b 50%, #0f1f27 100%)'
    };
    return gradients[this.accommodation.type] || gradients['HOTEL'];
  }
}
