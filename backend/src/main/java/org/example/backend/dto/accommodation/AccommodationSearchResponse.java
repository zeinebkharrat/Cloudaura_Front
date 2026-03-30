package org.example.backend.dto.accommodation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AccommodationSearchResponse {
    private int accommodationId;
    private String name;
    private String type;
    private double pricePerNight;
    private double rating;
    private String status;
    private String cityName;
    private String cityRegion;
    private int availableRoomsCount;
    private List<RoomResponse> rooms;
}
