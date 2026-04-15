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
  maxParticipantsPerDay: number | null;
  maxParticipantsStartDate: string | null;
}

export interface ReviewSummary {
  averageStars: number;
  totalReviews: number;
}

export interface PublicReview {
  reviewId: number;
  userId: number;
  username: string;
  userEmail: string | null;
  profileImageUrl: string | null;
  stars: number;
  commentText: string;
  createdAt: string;
}

export interface PublicReviewPageResponse {
  summary: ReviewSummary;
  reviews: PageResponse<PublicReview>;
}

export interface CreatePublicReviewRequest {
  stars: number;
  commentText: string;
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
  reservationDate: string;
  numberOfPeople: number;
  presentmentCurrency?: string;
}

export interface ActivityReservationResponse {
  reservationId: number;
  activityId: number;
  activityName: string;
  reservationDate: string;
  numberOfPeople: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  statusLabel?: string;
  cityId?: number | null;
  cityLabel?: string | null;
  nameLabel?: string | null;
}

export interface ActivityAvailabilityDay {
  date: string;
  maxParticipantsPerDay: number | null;
  reservedParticipants: number;
  remainingParticipants: number | null;
  available: boolean;
}

export interface ActivityReservationListItem {
  reservationId: number;
  activityId: number;
  activityName: string;
  cityId: number;
  cityName: string;
  reservationDate: string;
  numberOfPeople: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  statusLabel?: string;
  nameLabel?: string;
  cityLabel?: string;
  userId: number | null;
  username: string | null;
  userEmail: string | null;
}

export interface ActivityCheckoutSessionResponse {
  sessionId: string;
  sessionUrl: string;
}

export interface VoiceTranscriptionResponse {
  text: string;
  detectedLanguage: string | null;
  provider: string;
}

export interface OpenMeteoCurrentResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
}


