package org.example.backend.dto.transport;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Metadata for flight rows coming from search (Duffel / AviationStack) that are not persisted as
 * {@link org.example.backend.model.Transport} yet. Sent when {@code transportId &lt; 0} on checkout.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyntheticFlightOfferDto {

    @NotBlank
    @Size(max = 100)
    private String operatorName;

    @Size(max = 20)
    private String flightCode;

    /** 3-letter IATA (e.g. TUN, CDG). */
    @NotBlank
    @Size(min = 3, max = 4)
    private String departureIata;

    @NotBlank
    @Size(min = 3, max = 4)
    private String arrivalIata;

    /** Per-seat unit price in TND (stored on materialized {@code Transport.price}). */
    @NotNull
    @DecimalMin(value = "0.01", message = "pricePerSeatTnd must be positive")
    private Double pricePerSeatTnd;

    /** ISO-8601 local date-time for departure (optional if derivable from travelDate). */
    private String departureTimeIso;

    /** ISO-8601 local date-time for arrival. */
    private String arrivalTimeIso;

    @Size(max = 500)
    private String description;

    /** Original list price from provider (e.g. 76 EUR); informational — {@link #pricePerSeatTnd} is used for payment. */
    private Double quoteOriginalAmount;

    @Size(max = 8)
    private String quoteOriginalCurrency;
}
