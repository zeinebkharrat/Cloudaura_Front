import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { CurrencyService } from '../../core/services/currency.service';
import { FlightDto } from './flight.models';
import { effectivePriceTnd, priceUsesEstimate } from './flight-display.util';
import { flightBadge } from './flight-status.util';

@Component({
  selector: 'app-flight-list',
  standalone: true,
  imports: [CommonModule, TagModule, ButtonModule, SkeletonModule],
  templateUrl: './flight-list.component.html',
  styleUrl: './flight-list.component.css',
})
export class FlightListComponent {
  private readonly currency = inject(CurrencyService);

  @Input() flights: FlightDto[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() emptyMessage = '';
  @Input() idleHint = '';
  @Input() hasSearched = false;
  @Input() selected: FlightDto | null = null;
  @Input() mapMode = false;
  @Output() selectFlight = new EventEmitter<FlightDto>();
  @Output() bookFlight = new EventEmitter<FlightDto>();

  readonly skeletonPlaceholders = [1, 2, 3, 4, 5, 6];

  badge(f: FlightDto): { label: string; severity: 'success' | 'warn' | 'danger' | 'secondary' } {
    return flightBadge(f);
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

  trackByFn(_: number, f: FlightDto): string {
    return `${f.flightNumber}-${f.departureTime}-${f.arrivalTime}`;
  }

  isSelected(f: FlightDto): boolean {
    const s = this.selected;
    if (!s) return false;
    return (
      s.flightNumber === f.flightNumber &&
      s.departureIata === f.departureIata &&
      s.arrivalIata === f.arrivalIata &&
      s.departureTime === f.departureTime
    );
  }

  /** Reacts to {@link CurrencyService.displayRevision}. */
  priceLine(f: FlightDto): string {
    this.currency.displayRevision();
    const tnd = effectivePriceTnd(f, this.currency);
    const dual = this.currency.formatDual(tnd);
    return priceUsesEstimate(f) ? `${dual} · est.` : dual;
  }

  isBestPrice(f: FlightDto): boolean {
    this.currency.displayRevision();
    if (this.flights.length < 2) return false;
    const target = effectivePriceTnd(f, this.currency);
    let min = Infinity;
    for (const x of this.flights) {
      const v = effectivePriceTnd(x, this.currency);
      if (v < min) min = v;
    }
    return Math.abs(target - min) < 0.02;
  }
}
