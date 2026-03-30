package org.example.backend.dto.accommodation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AccommodationReservationRequest {
    private int roomId;
    private int userId;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Integer offerId;
}
