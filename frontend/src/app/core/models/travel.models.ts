export type AccommodationType = 'HOTEL' | 'GUESTHOUSE' | 'MAISON_HOTE' | 'AUTRE';
export type TransportType = 'BUS' | 'CAR' | 'PLANE' | 'TAXI' | 'VAN' | 'TRAIN' | 'FERRY';
export type AccommodationStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'KONNECT' | 'STRIPE' | 'PAYPAL';

export interface City {
  id: number;
  name: string;
  region: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  coords?: { lat: number; lng: number };
  stations?: CityInfrastructure;
}

export interface CityInfrastructure {
  bus: boolean;
  airport: boolean;
  ferry: boolean;
  train: boolean;
}

export interface Accommodation {
  id: number;
  name: string;
  type: AccommodationType;
  pricePerNight: number;
  rating: number;
  status: string;
  cityId: number;
  cityName?: string;
  cityRegion?: string;
  imageUrl?: string;
  address?: string;
  description?: string;
  mainPhotoUrl?: string;
  amenities?: string[];
  availableRoomsCount?: number;
  rooms?: Room[];
}

export interface Room {
  id: number;
  roomType: string;
  capacity: number;
  price: number;
  available: boolean;
}

export interface Transport {
  id: number;
  type: TransportType;
  departureCityId: number;
  arrivalCityId: number;
  departureCityName?: string;
  arrivalCityName?: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  capacity: number;
  availableSeats?: number;
  durationMinutes?: number;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePhotoUrl?: string;
  driverName?: string;
  driverRating?: number;
  description?: string;
  isActive: boolean;
}

export interface TransportTypeAvailability {
  type: TransportType;
  label: string;
  icon: string;
  available: boolean;
  reason?: string;
}

export interface TransportReservationInput {
  transportId: number;
  userId: number;
  passengerFirstName: string;
  passengerLastName: string;
  passengerEmail: string;
  passengerPhone: string;
  numberOfSeats: number;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  travelDate?: string;
  routeKm?: number;
  rentalDays?: number;
}

export interface TransportCheckoutPayload {
  transportId: number;
  numberOfSeats: number;
  travelDate: string;
  routeKm?: number;
  rentalDays?: number;
  passengerFirstName: string;
  passengerLastName: string;
  passengerEmail: string;
  passengerPhone: string;
  idempotencyKey: string;
}

/** PATCH body for updating an existing transport booking. */
export interface TransportReservationUpdatePayload {
  numberOfSeats: number;
  passengerFirstName: string;
  passengerLastName: string;
  passengerEmail: string;
  passengerPhone: string;
  paymentMethod: PaymentMethod;
}

export interface TransportReservation {
  transportReservationId: number;
  /** Backend trip id — open /transport/:id/book to change seats or see trip. */
  transportId?: number;
  reservationRef: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalPrice: number;
  numberOfSeats: number;
  travelDate: string;
  passengerFirstName: string;
  passengerLastName: string;
  passengerEmail: string;
  passengerPhone: string;
  qrCodeToken?: string;
  createdAt: string;
  transportType?: string;
  departureCityName?: string;
  arrivalCityName?: string;
  departureTime?: string;
}

/** Stay reservation list item (maps API accommodation reservation DTO). */
export interface AccommodationReservation {
  id: number;
  /** Present when API returns it — used to reopen edit flow. */
  accommodationId?: number;
  roomId?: number;
  status: ReservationStatus;
  totalPrice: number;
  accommodationName?: string;
  accommodationCity?: string;
  reservationRef?: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  roomType?: string;
  paymentMethod?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
}

/** WebSocket payload for live transport tracking. */
export interface TrackingUpdate {
  status?: 'IN_TRANSIT' | 'ARRIVED';
  progress?: number;
  totalSteps?: number;
  step?: number;
  lat?: number;
  lng?: number;
}

export interface Reservation {
  id: number;
  status: ReservationStatus;
  totalPrice: number;
  /** Set after accommodation Stripe confirm / list mapping. */
  accommodationId?: number;
  checkInDate?: string;
  checkOutDate?: string;
  /** API body for accommodation booking (LocalDate strings). */
  checkIn?: string;
  checkOut?: string;
  roomId?: number;
  userId?: number;
  transportId?: number;
  reservationRef?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  qrCodeToken?: string;
  nights?: number;
}

export interface TransportRecommendationRequest {
  fromCity: string;
  toCity: string;
  date?: string;
  passengers: number;
  budget: number;
  preference: 'cheap' | 'fast' | 'comfort' | 'balanced';
}

export interface TransportRecommendation {
  bestOption: TransportOption;
  alternativeOptions: TransportOption[];
  recommendationReason: string;
  combinationSuggestion?: string;
  distanceKm: number;
}

export interface TransportOption {
  transportType: string;
  price: number;
  pricePerPerson: number;
  priceFormatted: string;
  duration: string;
  durationMinutes: number;
  available: boolean;
  availabilityInfo: string;
  description: string;
  score: number;
  distanceKm: number;
  features: string[];
}

// ── New DB-backed Engine interfaces ──────────────────────────────────────────

export interface EngineRecommendationRequest {
  fromCityId?: number;
  toCityId?: number;
  fromCity?: string;
  toCity?: string;
  date?: string;
  passengers: number;
  preference: string;
}

export interface EngineTransportOption {
  transportId?: number;
  type: string;          // display label, e.g. "Bus SNTRI"
  rawType: string;       // enum name, e.g. "BUS"
  price: number;
  pricePerPerson: number;
  priceFormatted: string;
  duration: string;
  durationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  seatsLeft: number;
  available: boolean;
  availabilityInfo?: string;
  virtual: boolean;
  description?: string;
  features?: string[];
  score: number;
  aiScore: number;       // 0–100, higher is better
}

export interface EngineRecommendationResponse {
  bestOption: EngineTransportOption | null;
  alternatives: EngineTransportOption[];
  allOptions: EngineTransportOption[];
  recommendationReason: string;
  combinationSuggestion?: string;
  distanceKm: number;
  fromCity: string;
  toCity: string;
  passengers: number;
}

export const TRANSPORT_TYPE_META: Record<TransportType, { label: string; icon: string; requiresFrom: keyof CityInfrastructure | null; requiresTo: keyof CityInfrastructure | null }> = {
  BUS:   { label: 'Bus',         icon: 'pi pi-car',      requiresFrom: null,      requiresTo: null },
  VAN:   { label: 'Shared van',  icon: 'pi pi-truck',    requiresFrom: null,      requiresTo: null },
  TAXI:  { label: 'Taxi',        icon: 'pi pi-map',      requiresFrom: null,      requiresTo: null },
  CAR:   { label: 'Car rental',  icon: 'pi pi-car',      requiresFrom: null,      requiresTo: null },
  PLANE: { label: 'Flight',      icon: 'pi pi-send',     requiresFrom: 'airport', requiresTo: 'airport' },
  TRAIN: { label: 'Train',       icon: 'pi pi-building', requiresFrom: 'train',   requiresTo: 'train' },
  FERRY: { label: 'Ferry',       icon: 'pi pi-globe',    requiresFrom: 'ferry',   requiresTo: 'ferry' },
};
