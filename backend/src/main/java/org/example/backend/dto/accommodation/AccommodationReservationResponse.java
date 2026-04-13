package org.example.backend.dto.accommodation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AccommodationReservationResponse {
    private int reservationId;
    /** For reopening the booking flow (edit dates). */
    private Integer accommodationId;
    private Integer roomId;
    /** PENDING, CONFIRMED, CANCELLED */
    private String status;
    /** Localized status label for display. */
    private String statusLabel;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private int nights;
    private double totalPrice;
    private double discountApplied;
    /** Legacy alias; same value as nameLabel (catalog-localized). */
    private String accommodationName;
    /** Localized property name for display. */
    private String nameLabel;
    /** Room type enum code: SINGLE, DOUBLE, … */
    private String roomType;
    /** Localized room category for display. */
    private String roomTypeLabel;
    /** Legacy alias; same value as cityLabel. */
    private String cityName;
    /** Localized city for display. */
    private String cityLabel;
}
