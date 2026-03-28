package org.example.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ResendVerificationRequest(
        @NotBlank(message = "Identifier is required")
        String identifier
) {
}