package org.example.backend.dto.accommodation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RoomResponse {
    private int roomId;
    private String roomType;
    private int capacity;
    private double price;
    private boolean available;
}
