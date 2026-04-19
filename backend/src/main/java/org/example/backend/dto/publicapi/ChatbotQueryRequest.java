package org.example.backend.dto.publicapi;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ChatbotQueryRequest(
    @NotBlank(message = "Question is required")
    String question,
    List<String> conversation
) {
}
