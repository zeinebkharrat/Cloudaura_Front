package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportReservationResponse {
    private int transportReservationId;
    private String reservationRef;
    private String status;
    private String paymentStatus;
    private String paymentMethod;
    private double totalPrice;
    private int numberOfSeats;
    private String passengerFullName;
    private LocalDateTime travelDate;
    private String departureCityName;
    private String arrivalCityName;
    private LocalDateTime createdAt;
}
