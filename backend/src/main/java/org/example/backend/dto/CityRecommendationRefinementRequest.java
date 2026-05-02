package org.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityRecommendationRefinementRequest {
    private TravelPreferenceDto preferences;
    private List<CityRecommendationDto> recommendations;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TravelPreferenceDto {
        private Double budgetMin;
        private Double budgetMax;
        private List<String> travelStyles;
        private String preferredRegion;
        private String preferredCuisine;
        private String travelWith;
        private String transportPreference;
        private String accommodationType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CityRecommendationDto {
        private String cityName;
        private Double score;
        private Double percentage;
        private String region;
        private String activities;
        private String event;
    }
}
