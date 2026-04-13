import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

export interface PreferenceSurveyPayload {
  interests: string[];
  preferredRegion: string;
  travelWith: string;
  budgetLevel: string;
  accommodationType: string;
  transportPreference: string;
  preferredCuisine: string;
}

export interface PersonalizedRecommendationsResponse {
  preferencesCompleted: boolean;
  recommendedCities: Array<{
    cityId: number;
    name: string;
    region: string | null;
    description: string | null;
    imageUrl: string | null;
    score: number;
  }>;
  recommendedActivities: Array<{
    activityId: number;
    cityId: number | null;
    cityName: string | null;
    name: string;
    type: string | null;
    description: string | null;
    price: number | null;
    imageUrl: string | null;
    score: number;
  }>;
  recommendedEvents: Array<{
    eventId: number;
    cityId: number | null;
    cityName: string | null;
    title: string;
    eventType: string | null;
    venue: string | null;
    startDate: string | null;
    price: number | null;
    imageUrl: string | null;
    score: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class PersonalizationService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/personalization';

  getStatus() {
    return this.http
      .get<{ preferencesCompleted?: boolean }>(`${this.base}/status`)
      .pipe(map((res) => !!res?.preferencesCompleted));
  }

  savePreferences(payload: PreferenceSurveyPayload) {
    return this.http.put<void>(`${this.base}/preferences`, payload);
  }

  getRecommendations() {
    return this.http.get<PersonalizedRecommendationsResponse>(`${this.base}/recommendations`);
  }
}
