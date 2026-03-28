package org.example.backend.dto.publicapi;

import org.example.backend.model.ReservationStatus;

public record ActivityReservationResponse(
    Integer reservationId,
    Integer activityId,
    String activityName,
    String reservationDate,
    Integer numberOfPeople,
    Double totalPrice,
    ReservationStatus status
) {
}