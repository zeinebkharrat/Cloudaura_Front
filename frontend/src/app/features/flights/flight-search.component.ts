import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

export interface FlightDestinationSuggestion {
  label: string;
  pickValue: string;
}

@Component({
  selector: 'app-flight-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  templateUrl: './flight-search.component.html',
  styleUrl: './flight-search.component.css',
})
export class FlightSearchComponent {
  @Input() loading = false;
  @Input() destinationQuery = '';
  @Input() originIata = 'TUN';
  @Input() suggestions: FlightDestinationSuggestion[] = [];
  @Input() flightNumberQuery = '';
  @Input() flightSearchDate = '';

  @Output() destinationQueryChange = new EventEmitter<string>();
  @Output() originIataChange = new EventEmitter<string>();
  @Output() searchSubmit = new EventEmitter<void>();
  @Output() pickSuggestion = new EventEmitter<string>();
  @Output() flightNumberQueryChange = new EventEmitter<string>();
  @Output() flightSearchDateChange = new EventEmitter<string>();
  @Output() flightSearchSubmit = new EventEmitter<void>();

  onPick(s: FlightDestinationSuggestion): void {
    this.pickSuggestion.emit(s.pickValue);
  }

  onSearchClick(): void {
    this.searchSubmit.emit();
  }

  onFlightSearchClick(): void {
    this.flightSearchSubmit.emit();
  }

  isFlightQueryValid(): boolean {
    const q = (this.flightNumberQuery || '').trim();
    if (q.length < 2) {
      return false;
    }
    if (/^\d{1,4}$/.test(q)) {
      return true;
    }
    return /^[A-Za-z]{2}\s*\d{1,4}$/.test(q);
  }
}
