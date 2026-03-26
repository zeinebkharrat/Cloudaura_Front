package org.example.backend.dto;

public record SocialProvidersResponse(
        boolean google,
        boolean github
) {
}
