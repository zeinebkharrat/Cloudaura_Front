package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.backend.model.Transport;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportEstimateRequest {
    private Integer userId;
    private Integer departureCityId;
    private Integer arrivalCityId;
    private LocalDate travelDate;
    private Transport.TransportType transportType;
    private Integer seats;
    private Double routeKm;
    private Integer routeDurationMin;
    private Integer rentalDays;
}
