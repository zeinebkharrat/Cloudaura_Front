package org.example.backend.dto.accommodation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AccommodationSearchRequest {
    /** null or zero = all cities */
    private Integer cityId;
    private String type;
    private Double minPrice;
    private Double maxPrice;
    private Double minRating;
    private LocalDate checkIn;
    private LocalDate checkOut;
}
