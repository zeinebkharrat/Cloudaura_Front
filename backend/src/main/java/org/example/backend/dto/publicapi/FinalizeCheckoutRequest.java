package org.example.backend.dto.publicapi;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FinalizeCheckoutRequest {
    @NotBlank(message = "sessionId is required")
    private String sessionId;
}
