package org.example.backend.dto.publicapi;

import org.example.backend.dto.PageResponse;

public record PublicReviewPageResponse(
    ReviewSummaryResponse summary,
    PageResponse<PublicReviewResponse> reviews
) {
}
