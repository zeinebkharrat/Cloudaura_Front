package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Partial update — only non-null fields are applied. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportReservationUpdateRequest {
    private Integer numberOfSeats;
    private String passengerFirstName;
    private String passengerLastName;
    private String passengerEmail;
    private String passengerPhone;
    private String paymentMethod;
}
