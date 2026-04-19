package org.example.backend.dto.flight;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlightOfferDto {

    private String offerId;
    private Integer transportId;
    private String flightNumber;
    private String airline;
    private String departureAirport;
    private String departureIata;
    private String arrivalAirport;
    private String arrivalIata;
    private String departureTime;
    private String arrivalTime;
    private String status;
    private String statusCategory;
    private Double departureLatitude;
    private Double departureLongitude;
    private Double arrivalLatitude;
    private Double arrivalLongitude;
    private String totalAmount;
    private String totalCurrency;
}
