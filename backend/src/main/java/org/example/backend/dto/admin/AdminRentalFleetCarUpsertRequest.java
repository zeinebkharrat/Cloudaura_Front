package org.example.backend.dto.admin;

import java.math.BigDecimal;

public record AdminRentalFleetCarUpsertRequest(
        Integer cityId,
        String category,
        String modelLabel,
        BigDecimal dailyRateTnd,
        Boolean isActive) {
}
