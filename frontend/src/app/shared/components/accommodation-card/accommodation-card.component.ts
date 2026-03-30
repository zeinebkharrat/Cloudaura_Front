import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Accommodation } from '../../../core/models/travel.models';

@Component({
  selector: 'app-accommodation-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hotel-card" (click)="select.emit()">
      <!-- Image Area with gradient overlay -->
      <div class="card-visual" [style.background]="getGradient()">
        <div class="visual-content">
          <span class="type-pill">{{ formatType(accommodation.type) }}</span>
          <div class="visual-icon">{{ getIcon(accommodation.type) }}</div>
        </div>
        <!-- Rating badge -->
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
          <span>{{ accommodation.cityName || 'Tunisie' }}</span>
          <span class="region-tag" *ngIf="accommodation.cityRegion">{{ accommodation.cityRegion }}</span>
        </div>

        <!-- Quick amenities -->
        <div class="amenity-row">
          <span class="amenity-chip">📶 Wi-Fi</span>
          <span class="amenity-chip">🅿️ Parking</span>
          <span class="amenity-chip" *ngIf="accommodation.rating >= 4">🏊 Piscine</span>
        </div>

        <!-- Footer -->
        <div class="card-footer">
          <div class="price-block">
            <span class="price-value">{{ accommodation.pricePerNight | number:'1.0-0' }}</span>
            <span class="price-currency">TND<small>/nuit</small></span>
          </div>
          <button class="btn-voir">
            Voir <span class="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hotel-card {
      background: #161922;
      border: 1px solid rgba(255,255,255,0.06);
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
      box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(241,37,69,0.2);
      border-color: rgba(241,37,69,0.3);
    }

    /* Visual Area */
    .card-visual {
      height: 180px;
      position: relative;
      display: flex;
      overflow: hidden;
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
    .visual-icon {
      font-size: 3.5rem;
      opacity: 0.15;
      position: absolute;
      right: 16px;
      bottom: 10px;
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
      z-index: 2;
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
      color: #fff;
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
      color: rgba(255,255,255,0.5);
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    .loc-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #f12545;
      flex-shrink: 0;
    }
    .region-tag {
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.45);
    }

    /* Amenities */
    .amenity-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .amenity-chip {
      font-size: 0.72rem;
      padding: 4px 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 6px;
      color: rgba(255,255,255,0.6);
    }

    /* Footer */
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .price-block { display: flex; align-items: baseline; gap: 4px; }
    .price-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: #fff;
    }
    .price-currency {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.4);
    }
    .price-currency small {
      font-size: 0.7rem;
    }
    .btn-voir {
      background: #f12545;
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
      background: #ff3355;
      transform: translateX(2px);
      box-shadow: 0 4px 12px rgba(241,37,69,0.3);
    }
    .arrow { transition: transform 0.2s; }
    .hotel-card:hover .arrow { transform: translateX(3px); }
  `]
})
export class AccommodationCardComponent {
  @Input() accommodation!: Accommodation;
  @Output() select = new EventEmitter<void>();

  formatType(type: string): string {
    const map: Record<string, string> = {
      'HOTEL': '🏨 Hôtel',
      'MAISON_HOTE': '🏡 Maison d\'hôtes',
      'GUESTHOUSE': '🛖 Gîte',
      'AUTRE': '🏠 Hébergement'
    };
    return map[type] || type;
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      'HOTEL': '🏨', 'MAISON_HOTE': '🏡', 'GUESTHOUSE': '🛖', 'AUTRE': '🏠'
    };
    return icons[type] || '🏨';
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
