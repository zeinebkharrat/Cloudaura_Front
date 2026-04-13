package org.example.backend.dto.publicapi;

import org.example.backend.dto.CityResponse;

public record CityImageDetectionResponse(
    boolean matched,
    CityResponse city,
    double confidence,
    String message
) {
}
