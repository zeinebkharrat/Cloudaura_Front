package org.example.backend.dto;

public record RestaurantResponse(
    Integer restaurantId,
    Integer cityId,
    String cityName,
    String name,
    String cuisineType,
    Double rating,
    String description,
    String address,
    Double latitude,
    Double longitude
) {
}