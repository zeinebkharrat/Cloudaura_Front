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
    private String status;
    private String paymentStatus;
    private String paymentMethod;
    private double totalPrice;
    private int numberOfSeats;
    private String passengerFullName;
    private String passengerFirstName;
    private String passengerLastName;
    private String passengerEmail;
    private String passengerPhone;
    private LocalDateTime travelDate;
    private String departureCityName;
    private String arrivalCityName;
    /** BUS, TAXI, VAN, etc. from the linked transport entity. */
    private String transportType;
    private LocalDateTime createdAt;
    /** Payload encoded in the boarding QR (JSON); set when status is CONFIRMED. */
    private String qrCodeToken;
}
