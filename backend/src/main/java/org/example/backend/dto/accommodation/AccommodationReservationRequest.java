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
    private Integer guestCount;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Integer offerId;

    /** Optional Stripe Checkout presentment: {@code tnd}, {@code eur}, or {@code usd}. */
    private String presentmentCurrency;
}
