import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';

export type UiFlightType = 'internal' | 'external';

export interface FlightDestinationSuggestion {
  label: string;
  pickValue: string;
}

export interface FlightSearchFormValue {
  flightType: UiFlightType;
  from: string;
  to: string;
  date: Date | null;
}

export interface AirportOption {
  iata: string;
  label: string;
}

@Component({
  selector: 'app-flight-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, DatePickerModule, SelectModule],
  templateUrl: './flight-search.component.html',
  styleUrl: './flight-search.component.css',
})
export class FlightSearchComponent {
  @Input() loading = false;
  @Input() flightType: UiFlightType = 'internal';
  @Input() from = '';
  @Input() to = '';
  @Input() travelDate: Date | null = null;
  @Input() minTravelDate: Date | null = null;
  @Input() tunisianAirports: AirportOption[] = [];
  @Input() fromSuggestions: FlightDestinationSuggestion[] = [];
  @Input() internalSearchDisabled = true;
  @Input() externalSearchDisabled = true;
  @Input() validationMessage: string | null = null;
  @Input() fromInvalid = false;
  @Input() toInvalid = false;
  @Input() dateInvalid = false;

  @Output() flightTypeChange = new EventEmitter<UiFlightType>();
  @Output() fromChange = new EventEmitter<string>();
  @Output() toChange = new EventEmitter<string>();
  @Output() travelDateChange = new EventEmitter<Date | null>();
  @Output() searchSubmit = new EventEmitter<FlightSearchFormValue>();
  @Output() externalSearch = new EventEmitter<FlightSearchFormValue>();
  @Output() pickFromSuggestion = new EventEmitter<string>();
  @Output() swapRequested = new EventEmitter<void>();

  onPick(s: FlightDestinationSuggestion): void {
    this.pickFromSuggestion.emit(s.pickValue);
  }

  onSearchClick(): void {
    this.searchSubmit.emit(this.currentValue());
  }

  onExternalClick(): void {
    this.externalSearch.emit(this.currentValue());
  }

  onTypePick(nextType: UiFlightType): void {
    this.flightTypeChange.emit(nextType);
  }

  get fromDescribedBy(): string {
    return this.validationMessage ? 'flight-search-error' : 'flight-search-help';
  }

  get toDescribedBy(): string {
    return this.validationMessage ? 'flight-search-error' : 'flight-search-help';
  }

  get dateDescribedBy(): string {
    return this.validationMessage ? 'flight-search-error' : 'flight-search-help';
  }

  private currentValue(): FlightSearchFormValue {
    return {
      flightType: this.flightType,
      from: this.from,
      to: this.to,
      date: this.travelDate,
    };
  }
}
