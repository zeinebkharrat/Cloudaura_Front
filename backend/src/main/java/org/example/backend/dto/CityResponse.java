package org.example.backend.dto;

public record CityResponse(
    Integer cityId,
    String name,
    String region,
    String description,
    Double latitude,
    Double longitude
) {
    public Integer id() {
        return cityId;
    }
}
