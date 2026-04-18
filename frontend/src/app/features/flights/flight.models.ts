/** Mirrors backend {@code ApiResponse<T>}. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  /** Backend JSON uses `code` (also accepts legacy `errorCode`). */
  code?: string;
  errorCode?: string;
  status?: number;
  timestamp?: string;
}

/** Mirrors backend {@code FlightDto}. */
export interface FlightDto {
  flightNumber: string;
  airline: string;
  departureAirport: string;
  departureIata: string | null;
  arrivalAirport: string;
  arrivalIata: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  status: string;
  statusCategory: string;
  departureLatitude: number | null;
  departureLongitude: number | null;
  arrivalLatitude: number | null;
  arrivalLongitude: number | null;
}

export interface FlightSuggestionResponse {
  originAirportIata: string;
  destinationAirportIata: string | null;
  resolvedDestinationLabel: string | null;
  hint: string | null;
  flights: FlightDto[];
}

export interface AirportResolveResponse {
  query: string;
  iata: string | null;
  label: string | null;
  found: boolean;
}
