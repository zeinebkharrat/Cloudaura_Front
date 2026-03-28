package org.example.backend.dto;

public record AuthResponse(
        String token,
        long expiresIn,
        UserSummaryResponse user
) {
}
