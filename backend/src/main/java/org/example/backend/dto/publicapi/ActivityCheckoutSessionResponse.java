package org.example.backend.dto.publicapi;

public record ActivityCheckoutSessionResponse(
    String sessionId,
    String sessionUrl
) {
}
