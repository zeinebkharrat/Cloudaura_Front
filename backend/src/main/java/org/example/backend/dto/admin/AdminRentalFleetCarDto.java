package org.example.backend.dto.admin;

import java.math.BigDecimal;

/**
 * Admin read model for {@link org.example.backend.model.RentalFleetCar}.
 */
public record AdminRentalFleetCarDto(
        Integer fleetCarId,
        Integer cityId,
        String cityName,
        String category,
        String modelLabel,
        BigDecimal dailyRateTnd,
        boolean isActive,
        long reservationCount) {
}
