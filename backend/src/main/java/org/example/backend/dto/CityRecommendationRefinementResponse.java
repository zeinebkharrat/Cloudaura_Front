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
public class CityRecommendationRefinementResponse {
    private List<CityRecommendationRefinedDto> refinedRecommendations;
    private String aiExplanation;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CityRecommendationRefinedDto {
        private String cityName;
        private Double refinedScore; // 0 to 1
        private Double refinedPercentage; // 0 to 100
        private String logicReasoning;
    }
}
