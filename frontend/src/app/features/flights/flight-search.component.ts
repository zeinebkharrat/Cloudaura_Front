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

  @Output() destinationQueryChange = new EventEmitter<string>();
  @Output() originIataChange = new EventEmitter<string>();
  @Output() searchSubmit = new EventEmitter<void>();
  @Output() pickSuggestion = new EventEmitter<string>();

  onPick(s: FlightDestinationSuggestion): void {
    this.pickSuggestion.emit(s.pickValue);
  }

  onSearchClick(): void {
    this.searchSubmit.emit();
  }
}
