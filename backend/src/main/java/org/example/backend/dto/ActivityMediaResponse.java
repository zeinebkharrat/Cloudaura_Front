package org.example.backend.dto;

import org.example.backend.model.MediaType;

public record ActivityMediaResponse(
    Integer mediaId,
    Integer activityId,
    String activityName,
    String url,
    MediaType mediaType
) {
}
