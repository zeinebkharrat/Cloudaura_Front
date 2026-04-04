package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportRecommendationRequest {
    private String fromCity;
    private String toCity;
    private String date;
    private int passengers;
    private double budget;
    private String preference; // cheap / fast / comfort
}
