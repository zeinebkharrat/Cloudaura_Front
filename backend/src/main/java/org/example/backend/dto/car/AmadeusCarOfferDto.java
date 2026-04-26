package org.example.backend.dto.car;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Normalized car / private-transfer offer for the Yalla TN UI.
 * Populated from Amadeus {@code POST /v1/shopping/transfer-offers} response items.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AmadeusCarOfferDto {

    /** Amadeus offer id — required for real booking; echoed in simulation. */
    private String offerId;

    /** Operator / brand from {@code serviceProvider.name}. */
    private String provider;

    /** Vehicle description or category from {@code vehicle}. */
    private String model;

    /** Total from {@code quotation.monetaryAmount}. */
    private double price;

    /** ISO currency from {@code quotation.currencyCode}. */
    private String currency;

    /** Human-readable route label (pickup IATA → drop-off city). */
    private String location;

    /** Amadeus transfer type (e.g. PRIVATE, HOURLY). */
    private String transferType;

    /** Pickup ISO local date-time sent to Amadeus. */
    private String pickupDateTime;
}
