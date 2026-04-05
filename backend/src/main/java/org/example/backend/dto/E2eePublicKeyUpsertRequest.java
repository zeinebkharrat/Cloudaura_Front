package org.example.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record E2eePublicKeyUpsertRequest(
        @NotBlank String publicKey
) {
}
