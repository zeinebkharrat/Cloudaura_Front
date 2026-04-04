package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportRecommendationResponse {
    private TransportOption bestOption;
    private List<TransportOption> alternativeOptions;
    private String recommendationReason;
    private String combinationSuggestion;
    private int distanceKm;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TransportOption {
        private String transportType;
        private double price;
        private double pricePerPerson;
        private String priceFormatted;
        private String duration;
        private int durationMinutes;
        private boolean available;
        private String availabilityInfo;
        private String description;
        private double score;
        private int distanceKm;
        private List<String> features;
    }
}
