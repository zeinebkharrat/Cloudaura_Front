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
}

export interface Activity {
  activityId: number;
  cityId: number;
  cityName: string;
  name: string;
  type: string | null;
  price: number | null;
}

export interface ActivityRequest {
  cityId: number;
  name: string;
  type: string | null;
  price: number | null;
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