package org.example.backend.dto;

import java.util.Date;

public record StoryResponse(
        Integer storyId,
        Integer authorId,
        String authorUsername,
        String authorFirstName,
        String authorLastName,
        String authorProfileImageUrl,
        String caption,
        String visibility,
        String status,
        Integer viewsCount,
        Integer likesCount,
        Date createdAt,
        Date expiresAt,
        Date archivedAt,
        String mediaUrl,
        String mediaType,
        boolean viewedByCurrentUser,
        boolean likedByCurrentUser
) {
}
