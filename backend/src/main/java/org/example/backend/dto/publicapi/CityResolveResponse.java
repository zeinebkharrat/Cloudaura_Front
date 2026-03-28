package org.example.backend.dto;

import org.example.backend.dto.CityResponse;

public record CityResolveResponse(
    CityResponse city,
    boolean exactMatch
) {
}
