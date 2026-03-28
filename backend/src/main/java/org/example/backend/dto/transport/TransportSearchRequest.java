package org.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportSearchRequest {
    private int departureCityId;
    private int arrivalCityId;
    private LocalDate travelDate;
    private String type; // BUS/TAXI/VAN/CAR/PLANE
    @Builder.Default
    private int numberOfPassengers = 1;
}
