package org.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class GeoReverseResponse {
    private Integer cityId;
    private String name;
    private String region;
    private Double latitude;
    private Double longitude;
    private boolean matchedInSystem;
    private String rawLocationName;
}
