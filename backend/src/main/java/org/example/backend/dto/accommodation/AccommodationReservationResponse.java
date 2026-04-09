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
    private String status;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private int nights;
    private double totalPrice;
    private double discountApplied;
    private String accommodationName;
    private String roomType;
    private String cityName;
}
