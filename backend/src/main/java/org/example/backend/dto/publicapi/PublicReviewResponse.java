package org.example.backend.dto.publicapi;

import java.util.Date;

public record PublicReviewResponse(
    Integer reviewId,
    Integer userId,
    String username,
    String userEmail,
    String profileImageUrl,
    Integer stars,
    String commentText,
    Date createdAt
) {
}
