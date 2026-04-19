package org.example.backend.dto.publicapi;

import java.util.List;

public record ChatbotQueryResponse(
    String answer,
    boolean outOfScope,
    List<String> sources,
    double confidence
) {
}
