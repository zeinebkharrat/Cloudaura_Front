import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { FlightOfferDto } from './flight.models';
import { flightBadge } from './flight-status.util';

@Component({
  selector: 'app-flight-list',
  standalone: true,
  imports: [CommonModule, TagModule, ButtonModule, SkeletonModule],
  templateUrl: './flight-list.component.html',
  styleUrl: './flight-list.component.css',
})
export class FlightListComponent {
  @Input() flights: FlightOfferDto[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() emptyMessage = '';
  @Input() idleHint = '';
  @Input() hasSearched = false;
  @Input() selected: FlightOfferDto | null = null;
  @Input() mapMode = false;
  @Input() cheapestOfferId: string | null = null;
  @Output() selectFlight = new EventEmitter<FlightOfferDto>();
  @Output() bookFlight = new EventEmitter<FlightOfferDto>();

  readonly skeletonPlaceholders = [1, 2, 3, 4, 5, 6];

  badge(f: FlightOfferDto): { label: string; severity: 'success' | 'warn' | 'danger' | 'secondary' } {
    return flightBadge(f);
  }

  displayPrice(f: FlightOfferDto): string {
    const amount = f.totalAmount?.trim();
    const currency = f.totalCurrency?.trim();
    if (!amount) return 'Price on request';
    return currency ? `${amount} ${currency}` : amount;
  }

  formatTime(iso: string | null): string {
    if (!iso) return '—';
    const d = Date.parse(iso);
    if (Number.isNaN(d)) return iso;
    return new Date(d).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByFn(_: number, f: FlightOfferDto): string {
    return f.offerId || `${f.flightNumber}-${f.departureTime}-${f.arrivalTime}`;
  }

  isSelected(f: FlightOfferDto): boolean {
    const s = this.selected;
    if (!s) return false;
    return (
      s.flightNumber === f.flightNumber &&
      s.departureIata === f.departureIata &&
      s.arrivalIata === f.arrivalIata &&
      s.departureTime === f.departureTime
    );
  }

  isCheapest(f: FlightOfferDto): boolean {
    return !!this.cheapestOfferId && f.offerId === this.cheapestOfferId;
  }
}
