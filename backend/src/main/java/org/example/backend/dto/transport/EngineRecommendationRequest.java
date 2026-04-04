package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EngineRecommendationRequest {
    /** Primary: city IDs (preferred – direct DB lookup). */
    private Integer fromCityId;
    private Integer toCityId;

    /** Fallback: city names (resolved via CityRepository.findByName). */
    private String fromCity;
    private String toCity;

    /** Travel date (yyyy-MM-dd). Defaults to today if absent. */
    private String date;

    /** Number of passengers (min 1). */
    private int passengers;

    /** User preference: budget | fast | comfort | family | balanced */
    private String preference;
}
