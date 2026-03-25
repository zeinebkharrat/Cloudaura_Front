package org.example.backend.dto.publicapi;

import org.example.backend.dto.CityResponse;

public record CityResolveResponse(
    CityResponse city,
    boolean exactMatch
) {
}