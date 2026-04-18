package org.example.backend.dto;

public record RestaurantMenuImageResponse(
    Integer menuImageId,
    String imageUrl,
    Integer displayOrder
) {
}