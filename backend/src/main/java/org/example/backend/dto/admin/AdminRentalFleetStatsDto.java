package org.example.backend.dto.admin;

public record AdminRentalFleetStatsDto(
        long totalFleetCars,
        long activeFleetCars,
        long distinctCities,
        long totalRentalReservations) {
}
