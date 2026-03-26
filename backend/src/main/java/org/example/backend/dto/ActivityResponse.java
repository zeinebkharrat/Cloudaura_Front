package org.example.backend.dto;

public record ActivityResponse(
    Integer activityId,
    Integer cityId,
    String cityName,
    String name,
    String type,
    Double price,
    String description,
    String address,
    Double latitude,
    Double longitude
) {
}