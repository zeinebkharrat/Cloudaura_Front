package org.example.backend.dto.transport;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportReservationRequest {
    /** Negative for flight-search rows — requires {@link #syntheticFlightOffer}. */
    private int transportId;
    private int userId;
    private int numberOfSeats;
    private String passengerFirstName;
    private String passengerLastName;
    private String passengerEmail;
    private String passengerPhone;
    /** CASH | KONNECT — use checkout-session for STRIPE. */
    private String paymentMethod;
    private String idempotencyKey;
    /** ISO date or date-time; if omitted, transport departure time is used. */
    private String travelDate;
    /** Required for TAXI pricing when using this endpoint. */
    private Double routeKm;
    /** Optional TAXI duration in minutes; if missing server estimates from distance. */
    private Integer routeDurationMin;
    /** CAR rental day count; optional, defaults to 1 server-side. */
    private Integer rentalDays;

    /** Required when {@code transportId < 0}. */
    @Valid
    private SyntheticFlightOfferDto syntheticFlightOffer;
}
