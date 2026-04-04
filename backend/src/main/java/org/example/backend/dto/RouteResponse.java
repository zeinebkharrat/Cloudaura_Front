package org.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RouteResponse {
    private double distanceKm;
    private int durationMinutes;
    private String mode;
    private Object polylineGeoJson;
    private List<RouteSegment> segments;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RouteSegment {
        private String mode;
        private String from;
        private String to;
        private double distanceKm;
        private int durationMin;
        private Double fromLat;
        private Double fromLng;
        private Double toLat;
        private Double toLng;
    }
}
