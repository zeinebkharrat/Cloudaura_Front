package org.example.backend.dto;

import org.example.backend.model.ReservationStatus;

public record ActivityReservationListItemResponse(
    Integer reservationId,
    Integer activityId,
    String activityName,
    Integer cityId,
    String cityName,
    String reservationDate,
    Integer numberOfPeople,
    Double totalPrice,
    ReservationStatus status,
    Integer userId,
    String username,
    String userEmail
) {
}
