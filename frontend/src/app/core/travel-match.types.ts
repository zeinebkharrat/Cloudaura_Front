/** Mirrors scripts/train_travel_match_model.py export */
export interface TravelMatchModelJson {
  schemaVersion: number;
  trainedOnRows: number;
  cities: string[];
  categoricalColumns: string[];
  numericColumns: string[];
  categories: Record<string, string[]>;
  numericMean: number[];
  numericScale: number[];
  centroids: Record<string, number[]>;
  cityPriors: Record<string, number>;
  metrics?: Record<string, number>;
}

export interface TravelPreferencePayload {
  age: number;
  gender: string;
  nationality: string;
  current_city: string;
  /** Legacy single style (first entry of travel_styles when saving). */
  travel_style: string;
  /** Selected travel vibes; multi-hot encoded against model.categories.travel_style. */
  travel_styles?: string[];
  budget_level: string;
  preferred_region: string;
  preferred_cuisine: string;
  travel_with: string;
  transport_preference: string;
  accommodation_type: string;
  travel_intensity: string;
  budget_avg: number;
  is_group: number;
}

export interface CityMatchScore {
  cityName: string;
  score01: number;
  percent: number;
}

/** Response from travel-recommendation Flask `POST /api/recommend` */
export interface TravelRecommendationApiResponse {
  schemaVersion?: number;
  source?: string;
  cities: Array<{ cityName: string; score01: number }>;
}
