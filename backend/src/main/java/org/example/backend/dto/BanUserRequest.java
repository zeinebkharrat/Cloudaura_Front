package org.example.backend.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;

import java.util.Date;

public record BanUserRequest(
        @NotBlank(message = "Ban reason is required")
        String reason,
        Boolean permanent,
        @Future(message = "Ban expiration must be in the future")
        Date expiresAt
) {
}
