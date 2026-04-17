package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportReservationResponse {
    private int transportReservationId;
    /** Same trip id as in /api/transports/{id} — used to reopen booking flow. */
    private Integer transportId;
    private String reservationRef;
    /** Machine code: PENDING, CONFIRMED, CANCELLED. */
    private String status;
    /** Localized status for display (catalog {@code reservation.status.*}). */
    private String statusLabel;
    /** Machine code: PENDING, PAID, REFUNDED. */
    private String paymentStatus;
    private String paymentStatusLabel;
    /** Machine code: CASH, KONNECT, STRIPE, PAYPAL. */
    private String paymentMethod;
    private String paymentMethodLabel;
    private double totalPrice;
    private int numberOfSeats;
    private String passengerFullName;
    private String passengerFirstName;
    private String passengerLastName;
    private String passengerEmail;
    private String passengerPhone;
    private LocalDateTime travelDate;
    /** Legacy field name; same value as departureCityLabel (catalog-localized). */
    private String departureCityName;
    /** Legacy field name; same value as arrivalCityLabel. */
    private String arrivalCityName;
    /** Localized departure city (catalog {@code city.{id}.name}). */
    private String departureCityLabel;
    /** Localized arrival city. */
    private String arrivalCityLabel;
    /** BUS, TAXI, VAN, etc. — machine code (same as {@link #type}). */
    private String transportType;
    /** Alias of {@link #transportType} for a uniform API contract. */
    private String type;
    /** Localized mode (same as {@link #typeLabel}). */
    private String transportTypeLabel;
    /** Localized transport mode for display. */
    private String typeLabel;
    private LocalDateTime createdAt;
    /** Payload encoded in the boarding QR (JSON); set when status is CONFIRMED. */
    private String qrCodeToken;
}
