package com.yallatn.dto.accommodation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AccommodationSearchRequest {
    private int cityId;
    private String type;
    private Double minPrice;
    private Double maxPrice;
    private Double minRating;
    private LocalDate checkIn;
    private LocalDate checkOut;
}
