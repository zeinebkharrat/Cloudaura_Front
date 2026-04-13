package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportSearchResponse {
    private int transportId;
    private String type;
    private String departureCityName;
    private String arrivalCityName;
    private LocalDateTime departureTime;
    private LocalDateTime arrivalTime;
    private double price;
    private int capacity;
    private int availableSeats;
    private int durationMinutes;
    private boolean isActive;
}
