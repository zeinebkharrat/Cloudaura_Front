package org.example.backend.dto;

public record E2eePublicKeyResponse(
        Integer userId,
        String publicKey
) {
}
