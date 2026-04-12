package org.example.backend.dto;

import java.util.Date;

public record StoryInteractionUserResponse(
        Integer userId,
        String username,
        String firstName,
        String lastName,
        String profileImageUrl,
        Date actedAt
) {
}
