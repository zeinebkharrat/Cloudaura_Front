package org.example.backend.dto.publicapi;

public record ReviewSummaryResponse(
    Double averageStars,
    Long totalReviews
) {
}
