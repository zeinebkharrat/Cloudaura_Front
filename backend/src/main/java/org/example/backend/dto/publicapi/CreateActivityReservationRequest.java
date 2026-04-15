package org.example.backend.dto.publicapi;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateActivityReservationRequest {
    @NotBlank(message = "reservationDate est obligatoire (format ISO)")
    private String reservationDate;

    @NotNull(message = "numberOfPeople est obligatoire")
    @Min(value = 1, message = "numberOfPeople doit être >= 1")
    private Integer numberOfPeople;

    /** Optional Stripe Checkout presentment: {@code tnd}, {@code eur}, or {@code usd}. */
    private String presentmentCurrency;
}
