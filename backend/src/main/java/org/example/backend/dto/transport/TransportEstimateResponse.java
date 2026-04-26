package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportEstimateResponse {
    private String transportType;
    private Integer departureCityId;
    private Integer arrivalCityId;
    private LocalDate travelDate;
    private Integer seats;
    private Double routeKm;
    private Integer routeDurationMin;

    private Double referencePriceTnd;
    private Double minPriceTnd;
    private Double maxPriceTnd;
    private String currency;

    private Boolean advisoryApplied;
    private String demandLevel;
    private String availabilityLevel;
    private Boolean reducedAvailability;
    private Boolean possibleHigherPrice;
    private String advisoryMessage;
}
