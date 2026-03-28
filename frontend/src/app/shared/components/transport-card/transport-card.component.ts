import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Transport } from '../../../core/models/travel.models';

@Component({
  selector: 'app-transport-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="transport-card glass-container">
      <div class="type-icon">
        @if (transport.type === 'BUS')         { 🚌 }
        @else if (transport.type === 'VAN')    { 🚐 }
        @else if (transport.type === 'TAXI')   { 🚕 }
        @else if (transport.type === 'CAR')    { 🚗 }
        @else if (transport.type === 'PLANE')  { ✈️ }
      </div>
      
      <div class="itinerary">
        <div class="time-block">
          <span class="time">{{ transport.departureTime | date:'HH:mm' }}</span>
          <span class="station">{{ transport.departureCityName }}</span>
        </div>
        
        <div class="duration-line">
          <div class="dot"></div>
          <div class="line"></div>
          <div class="dot"></div>
        </div>
        
        <div class="time-block">
          <span class="time">{{ transport.arrivalTime | date:'HH:mm' }}</span>
          <span class="station">{{ transport.arrivalCityName }}</span>
        </div>
      </div>

      <div class="booking-section">
        <div class="operator">{{ transport.vehicleBrand }} {{ transport.vehicleModel }}</div>
        <div class="price">{{ transport.price }} TND</div>
        <button class="btn-primary" (click)="select.emit()">Réserver</button>
      </div>
    </div>
  `,
  styles: [`
    .transport-card {
      display: flex;
      align-items: center;
      gap: 2rem;
      padding: 1.5rem 2rem;
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .transport-card:hover {
      border-color: var(--primary-color);
      transform: scale(1.01);
    }
    .type-icon { font-size: 2rem; }
    .itinerary {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-grow: 1;
    }
    .time-block { display: flex; flex-direction: column; min-width: 100px; }
    .time { font-size: 1.3rem; font-weight: 700; color: white; }
    .station { font-size: 0.85rem; color: rgba(255,255,255,0.6); }
    
    .duration-line {
      display: flex;
      align-items: center;
      flex-grow: 1;
      max-width: 150px;
    }
    .line { height: 2px; background: rgba(255,255,255,0.2); flex-grow: 1; position: relative; }
    .dot { width: 8px; height: 8px; background: var(--primary-color); border-radius: 50%; }

    .booking-section {
      text-align: right;
      border-left: 1px solid rgba(255,255,255,0.1);
      padding-left: 2rem;
    }
    .operator { font-size: 0.9rem; color: var(--secondary-color); font-weight: 600; margin-bottom: 4px; }
    .price { font-size: 1.5rem; font-weight: 800; color: white; margin-bottom: 10px; }

    @media (max-width: 700px) {
      .transport-card { flex-direction: column; text-align: center; gap: 1rem; }
      .itinerary { width: 100%; justify-content: center; }
      .booking-section { border-left: none; border-top: 1px solid rgba(255,255,255,0.1); padding: 1rem 0 0 0; width: 100%; text-align: center; }
    }
  `]
})
export class TransportCardComponent {
  @Input() transport!: Transport;
  @Output() select = new EventEmitter<void>();
}
