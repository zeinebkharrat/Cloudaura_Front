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

/** Mirrors backend {@code FlightOfferDto}. */
export interface FlightOfferDto {
  offerId: string;
  transportId: number | null;
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
  totalAmount: string | null;
  totalCurrency: string | null;
}

export interface FlightSuggestionResponse {
  originAirportIata: string;
  destinationAirportIata: string | null;
  resolvedDestinationLabel: string | null;
  hint: string | null;
  flights: FlightOfferDto[];
}

export interface AirportResolveResponse {
  query: string;
  iata: string | null;
  label: string | null;
  found: boolean;
}

export interface FlightBookingRequest {
  offerId: string;
  givenName: string;
  familyName: string;
  email: string;
  phoneNumber?: string;
  bornOn?: string;
}

export interface FlightBookingResponse {
  orderId: string | null;
  bookingReference: string | null;
  owner: string | null;
  totalAmount: string | null;
  totalCurrency: string | null;
  status: string | null;
}
