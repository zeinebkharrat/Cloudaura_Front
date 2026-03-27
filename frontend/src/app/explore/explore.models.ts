export type MediaType = 'IMAGE' | 'VIDEO' | 'PANORAMA';

export interface City {
  cityId: number;
  name: string;
  region: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CityMedia {
  mediaId: number;
  cityId: number;
  cityName: string;
  url: string;
  mediaType: MediaType;
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
  imageUrl: string | null;
}

export interface ActivityMedia {
  mediaId: number;
  activityId: number;
  activityName: string;
  url: string;
  mediaType: MediaType;
}

export interface CityResolveResponse {
  city: City;
  exactMatch: boolean;
}

export interface PublicCityDetailsResponse {
  city: City;
  media: CityMedia[];
  restaurants: Restaurant[];
  activities: Activity[];
}

export interface CreateActivityReservationRequest {
  userId?: number | null;
  reservationDate: string;
  numberOfPeople: number;
}

export interface ActivityReservationResponse {
  reservationId: number;
  activityId: number;
  activityName: string;
  reservationDate: string;
  numberOfPeople: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}