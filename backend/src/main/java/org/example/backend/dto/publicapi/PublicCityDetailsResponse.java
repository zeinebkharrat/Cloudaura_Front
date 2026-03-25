package org.example.backend.dto.publicapi;

import org.example.backend.dto.ActivityResponse;
import org.example.backend.dto.CityMediaResponse;
import org.example.backend.dto.CityResponse;
import org.example.backend.dto.RestaurantResponse;

import java.util.List;

public record PublicCityDetailsResponse(
    CityResponse city,
    List<CityMediaResponse> media,
    List<RestaurantResponse> restaurants,
    List<ActivityResponse> activities
) {
}