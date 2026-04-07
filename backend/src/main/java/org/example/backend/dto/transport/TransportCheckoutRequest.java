package org.example.backend.dto.transport;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportCheckoutRequest {

    @NotNull
    private Integer transportId;

    @NotNull
    @Min(1)
    private Integer numberOfSeats;

    /** ISO-8601 local date-time for the journey (e.g. 2026-04-15T08:30:00). */
    @NotBlank
    private String travelDate;

    /** Required when transport type is TAXI (km for pricing). */
    private Double routeKm;

    /** Used for CAR rentals; optional, defaults to 1. */
    private Integer rentalDays;

    @NotBlank
    @Size(min = 2, max = 100)
    private String passengerFirstName;

    @NotBlank
    @Size(min = 2, max = 100)
    private String passengerLastName;

    @NotBlank
    @Email
    private String passengerEmail;

    @NotBlank
    @Size(max = 40)
    private String passengerPhone;

    @NotBlank
    @Size(min = 8, max = 36)
    private String idempotencyKey;
}
