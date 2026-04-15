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
    String statusLabel,
    Integer userId,
    String username,
    String userEmail,
    /** Localized activity title (same source as {@code activityName}). */
    String nameLabel,
    /** Localized city (same source as {@code cityName}). */
    String cityLabel
) {
}
