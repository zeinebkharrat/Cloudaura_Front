package org.example.backend.dto;

import java.util.List;

public record RestaurantResponse(
    Integer restaurantId,
    Integer cityId,
    String cityName,
    String name,
    String cuisineType,
    Double rating,
    String description,
    String address,
    String phoneNumber,
    Double latitude,
    Double longitude,
    String imageUrl,
    List<RestaurantMenuImageResponse> menuImages
) {
}
