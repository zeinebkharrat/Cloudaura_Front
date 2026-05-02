package org.example.backend.dto;

import java.util.List;

public record LoginRiskResponse(
        String status,
        boolean trusted,
        double riskScore,
        List<String> details,
        String message
) {
}