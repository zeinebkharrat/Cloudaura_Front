export type MediaType = 'IMAGE' | 'VIDEO' | 'PANORAMA';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  sort: string;
}

export interface City {
  cityId: number;
  name: string;
  region: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CityRequest {
  name: string;
  region: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Restaurant {
  restaurantId: number;
  cityId: number;
  cityName: string;
  name: string;
  cuisineType: string | null;
  rating: number | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
}

export interface RestaurantRequest {
  cityId: number;
  name: string;
  cuisineType: string | null;
  rating: number | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
}

export interface Activity {
  activityId: number;
  cityId: number;
  cityName: string;
  name: string;
  type: string | null;
  price: number | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  maxParticipantsPerDay: number | null;
  maxParticipantsStartDate: string | null;
}

export interface ActivityRequest {
  cityId: number;
  name: string;
  type: string | null;
  price: number | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  maxParticipantsPerDay: number | null;
  maxParticipantsStartDate: string | null;
}

export interface CityMedia {
  mediaId: number;
  cityId: number;
  cityName: string;
  url: string;
  mediaType: MediaType;
}

export interface CityMediaRequest {
  cityId: number;
  url: string;
  mediaType: MediaType;
}

export interface ActivityMedia {
  mediaId: number;
  activityId: number;
  activityName: string;
  url: string;
  mediaType: MediaType;
}

export interface ActivityMediaRequest {
  activityId: number;
  url: string;
  mediaType: MediaType;
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface ActivityReservationListItem {
  reservationId: number;
  activityId: number;
  activityName: string;
  cityId: number;
  cityName: string;
  reservationDate: string;
  numberOfPeople: number;
  totalPrice: number;
  status: ReservationStatus;
  userId: number | null;
  username: string | null;
  userEmail: string | null;
}