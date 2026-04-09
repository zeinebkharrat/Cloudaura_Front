package org.example.backend.dto;

public record PassportPhotoCreateRequest(
        Integer cityId,
        String photoUrl,
        String caption
) {
}
