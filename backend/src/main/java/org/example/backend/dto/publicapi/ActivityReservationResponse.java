package org.example.backend.dto.publicapi;

import org.example.backend.model.ReservationStatus;

public record ActivityReservationResponse(
    Integer reservationId,
    Integer activityId,
    /** Legacy alias; same localized value as {@link #nameLabel}. */
    String activityName,
    String reservationDate,
    Integer numberOfPeople,
    Double totalPrice,
    ReservationStatus status,
    String statusLabel,
    Integer cityId,
    String cityLabel,
    /** Localized activity title (catalog {@code activity.{id}.name}). */
    String nameLabel
) {
}
