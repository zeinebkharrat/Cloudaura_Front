package org.example.backend.dto.flight;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Smart feature: flights from a chosen origin IATA toward a destination (hotel city / airport).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlightSuggestionResponse {

    private String originAirportIata;
    private String destinationAirportIata;
    private String resolvedDestinationLabel;
    private String hint;

    private List<FlightDto> flights;
}
