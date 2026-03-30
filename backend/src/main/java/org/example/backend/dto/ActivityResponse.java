package org.example.backend.dto;

import java.time.LocalDate;

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
    Double longitude,
    String imageUrl,
    Integer maxParticipantsPerDay,
    LocalDate maxParticipantsStartDate
) {
}