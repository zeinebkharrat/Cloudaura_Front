package org.example.backend.dto.transport;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
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
public class TransportPayPalCreateRequest {

    /** Negative when booking from flight search — requires {@link #syntheticFlightOffer}. */
    @NotNull
    private Integer transportId;

    @NotNull
    @Min(1)
    private Integer seats;

    @NotBlank
    private String travelDate;

    private Double routeKm;

    private Integer routeDurationMin;

    @NotNull
    @DecimalMin(value = "0.01", message = "amountTnd must be positive")
    private Double amountTnd;

    /** When set, overrides account profile for the ticket (same data as Stripe checkout). */
    @Size(max = 100)
    private String passengerFirstName;

    @Size(max = 100)
    private String passengerLastName;

    @Email
    @Size(max = 255)
    private String passengerEmail;

    @Size(max = 40)
    private String passengerPhone;

    @Valid
    private SyntheticFlightOfferDto syntheticFlightOffer;
}
