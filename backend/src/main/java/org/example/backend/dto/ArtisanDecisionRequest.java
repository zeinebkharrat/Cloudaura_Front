package org.example.backend.dto;

import jakarta.validation.constraints.NotNull;

public record ArtisanDecisionRequest(
        @NotNull(message = "Decision is required")
        Boolean approved
) {
}
