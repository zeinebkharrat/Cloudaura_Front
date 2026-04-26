/** Mirrors scripts/train_travel_match_model.py export (schema v2). */
export interface TravelRecommendationModelJson {
  schemaVersion: number;
  trainedOnRows: number;
  featureColumns: {
    categorical: string[];
    numeric: string[];
  };
  targetColumns: string[];
  categories: Record<string, string[]>;
  numericMean: number[];
  numericScale: number[];
  cityLabelMap: Record<string, RecommendationPrediction>;
  profiles: RecommendationProfile[];
  metrics?: Record<string, number>;
}

export interface RecommendationPrediction {
  recommended_city_id: string;
  recommended_city_name: string;
  recommended_region: string;
  recommended_activities: string;
  recommended_event: string;
}

export interface RecommendationProfile {
  features: {
    accommodation_type: string;
    preferred_cuisine: string;
    preferred_region: string;
    transport_preference: string;
    travel_style: string;
    travel_with: string;
    budget_min: number;
    budget_max: number;
  };
  labels: RecommendationPrediction;
}

export interface TravelPreferencePayload {
  /** New model features */
  budget_min?: number;
  budget_max?: number;
  travel_styles?: string[];
  preferred_region: string;
  preferred_cuisine: string;
  travel_with: string;
  transport_preference: string;
  accommodation_type: string;

  /** Legacy fields kept optional for compatibility with existing save payloads. */
  age?: number;
  gender?: string;
  nationality?: string;
  current_city?: string;
  travel_style?: string;
  budget_level?: string;
  travel_intensity?: string;
  budget_avg?: number;
  budgetMin?: number;
  budgetMax?: number;
  is_group?: number;
}

export interface CityMatchScore {
  cityName: string;
  score01: number;
  percent: number;
  cityId?: string;
  recommendedRegion?: string;
  recommendedActivities?: string;
  recommendedEvent?: string;
}

/** Response from travel-recommendation Flask `POST /api/recommend` */
export interface TravelRecommendationApiResponse {
  schemaVersion?: number;
  source?: string;
  prediction?: RecommendationPrediction;
  cities: Array<{
    cityName: string;
    score01: number;
    recommended_city_id?: string;
    recommended_city_name?: string;
    recommended_region?: string;
    recommended_activities?: string;
    recommended_event?: string;
  }>;
}
