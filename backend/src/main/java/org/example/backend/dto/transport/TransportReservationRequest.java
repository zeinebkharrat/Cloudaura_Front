package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportReservationRequest {
    private int transportId;
    private int userId;
    private int numberOfSeats;
    private String passengerFirstName;
    private String passengerLastName;
    private String passengerEmail;
    private String passengerPhone;
    private String paymentMethod; // CASH | KONNECT
    private String idempotencyKey;
}
