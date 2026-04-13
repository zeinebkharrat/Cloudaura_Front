package org.example.backend.dto.flight;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Normalized flight row for the tourism app (mapped from Aviationstack JSON).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlightDto {

    private String flightNumber;
    private String airline;
    private String departureAirport;
    private String departureIata;
    private String arrivalAirport;
    private String arrivalIata;
    /** ISO-8601 string from provider (scheduled or estimated). */
    private String departureTime;
    private String arrivalTime;
    /** Raw status from API, e.g. scheduled, active, landed, cancelled. */
    private String status;
    /**
     * UI badge: ON_TIME, DELAYED, CANCELLED, UNKNOWN.
     */
    private String statusCategory;
    /** Approximate coords for map mode (mock / static table by IATA). */
    private Double departureLatitude;
    private Double departureLongitude;
    private Double arrivalLatitude;
    private Double arrivalLongitude;
}
