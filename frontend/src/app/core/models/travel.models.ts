export type AccommodationType = 'HOTEL' | 'GUESTHOUSE' | 'MAISON_HOTE' | 'AUTRE';
export type TransportType = 'BUS' | 'CAR' | 'PLANE' | 'TAXI' | 'VAN';
export type AccommodationStatus = 'AVAILABLE' | 'UNAVAILABLE';

export interface City {
  id: number;
  name: string;
  region: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  coords?: { lat: number, lng: number };
  stations?: { bus: boolean, airport: boolean, ferry: boolean, train: boolean };
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
  driverName?: string;
  driverRating?: number;
  isActive: boolean;
}

export interface Reservation {
  id: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  totalPrice: number;
  checkInDate?: string;
  checkOutDate?: string;
  roomId?: number;
  userId?: number;
  transportId?: number;
  reservationRef?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  nights?: number;
}
