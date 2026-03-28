package org.example.backend.dto;

import org.example.backend.model.MediaType;

public record CityMediaResponse(
    Integer mediaId,
    Integer cityId,
    String cityName,
    String url,
    MediaType mediaType
) {
}
