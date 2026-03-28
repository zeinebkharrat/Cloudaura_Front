import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { TripContextStore } from '../../../core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from '../../../core/adapters/data-source.adapter';
import { Accommodation } from '../../../core/models/travel.models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container" *ngIf="accommodation() as acc">
      <div class="glass-container hero-section">
        <button class="btn-back" (click)="router.navigate(['/hebergement'])">← Retour à la liste</button>
        <div class="hero-content">
          <div class="image-gallery">
            <img [src]="acc.imageUrl || 'assets/placeholder.jpg'" [alt]="acc.name">
          </div>
          <div class="info-panel">
            <span class="badge">{{ acc.type }}</span>
            <h1>{{ acc.name }}</h1>
            <div class="rating">⭐ {{ acc.rating }} Excellence</div>
            <p class="description">
              Profitez d'un séjour inoubliable au coeur de la Tunisie. Cet établissement offre tout le confort moderne
              mêlé au charme traditionnel local.
            </p>
            <div class="amenities-list">
              <span class="amenity" *ngFor="let item of acc.amenities">{{ item }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="booking-sticky glass-container">
        <div class="price-info">
          <span class="price">{{ acc.pricePerNight }} TND </span>
          <span class="unit">par nuit</span>
        </div>
        <div class="trip-info">
          <span>{{ store.dates().checkIn || 'Selectionnez' }} → {{ store.dates().checkOut || 'des dates' }}</span>
          <span class="nights" *ngIf="store.calculateNights() > 0">({{ store.calculateNights() }} nuits)</span>
        </div>
        <button class="btn-primary large" (click)="onBook()">Réserver maintenant</button>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 2rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .hero-section {
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .btn-back {
      background: none;
      border: none;
      color: var(--primary-color);
      cursor: pointer;
      margin-bottom: 1.5rem;
      font-weight: 500;
      padding: 0;
    }
    .hero-content {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 2.5rem;
    }
    .image-gallery img {
      width: 100%;
      height: 450px;
      object-fit: cover;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .info-panel {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    h1 { font-size: 2.8rem; margin: 0.5rem 0; color: white; }
    .badge {
      background: var(--primary-color);
      color: #000;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 4px;
      width: fit-content;
      font-size: 0.8rem;
    }
    .rating { color: #f1c40f; margin-bottom: 1.5rem; font-weight: 600; }
    .description { color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 2rem; font-size: 1.1rem; }
    .amenities-list { display: flex; flex-wrap: wrap; gap: 10px; }
    .amenity { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 6px 15px; border-radius: 20px; font-size: 0.9rem; color: white; }
    
    .booking-sticky {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2.5rem;
      position: sticky;
      bottom: 2rem;
      border: 1px solid var(--primary-color);
    }
    .price { font-size: 1.8rem; font-weight: 800; color: white; }
    .unit { color: rgba(255,255,255,0.6); font-size: 1rem; }
    .trip-info { text-align: right; margin-right: 2rem; display: flex; flex-direction: column; }
    .nights { font-size: 0.8rem; color: var(--primary-color); }
    .btn-primary.large { padding: 15px 40px; font-size: 1.1rem; border-radius: 12px; }

    @media (max-width: 900px) {
      .hero-content { grid-template-columns: 1fr; }
      .image-gallery img { height: 300px; }
      .booking-sticky { flex-direction: column; gap: 1rem; text-align: center; }
      .trip-info { text-align: center; margin: 0; }
    }
  `]
})
export class AccommodationDetailsPageComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  store = inject(TripContextStore);
  dataSource = inject(DATA_SOURCE_TOKEN);

  accommodation = signal<Accommodation | null>(null);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.dataSource.getAccommodationDetails(id).subscribe(data => {
        this.accommodation.set(data);
        this.store.selectedAccommodation.set(data);
      });
    }
  }

  onBook() {
    const id = this.accommodation()?.id;
    this.router.navigate(['/hebergement', id, 'book']);
  }
}
