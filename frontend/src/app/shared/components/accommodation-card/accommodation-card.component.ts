import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Accommodation } from '../../../core/models/travel.models';

@Component({
  selector: 'app-accommodation-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-card" (click)="select.emit()">
      <div class="card-image" [style.background-image]="'url(' + (accommodation.imageUrl || 'assets/placeholder.jpg') + ')'">
        <div class="badge" *ngIf="accommodation.rating > 4.5">Top Rated</div>
      </div>
      <div class="card-content">
        <h3>{{ accommodation.name }}</h3>
        <div class="details">
          <span class="type">{{ accommodation.type }}</span>
          <span class="rating">⭐ {{ accommodation.rating }}</span>
        </div>
        <div class="amenities">
          <span *ngFor="let amenity of accommodation.amenities">{{ amenity }}</span>
        </div>
        <div class="footer">
          <div class="price">
            <span class="amount">{{ accommodation.pricePerNight }} TND</span>
            <span class="unit">/night</span>
          </div>
          <button class="btn-primary">View Details</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s ease;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .glass-card:hover {
      transform: translateY(-8px);
      box-shadow: var(--glass-shadow);
      border-color: var(--primary-color);
    }
    .card-image {
      height: 200px;
      background-size: cover;
      background-position: center;
      position: relative;
    }
    .badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--secondary-color);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .card-content {
      padding: 1.5rem;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }
    h3 {
      margin: 0 0 0.5rem 0;
      color: white;
      font-size: 1.25rem;
    }
    .details {
      display: flex;
      justify-content: space-between;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 1rem;
    }
    .amenities {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 1.5rem;
    }
    .amenities span {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.8);
    }
    .footer {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .price .amount {
      display: block;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--primary-color);
    }
    .price .unit {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--primary-color), #00a8cc);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class AccommodationCardComponent {
  @Input() accommodation!: Accommodation;
  @Output() select = new EventEmitter<void>();
}
