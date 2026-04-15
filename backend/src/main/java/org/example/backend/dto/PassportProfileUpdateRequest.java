package org.example.backend.dto;

public record PassportProfileUpdateRequest(
        String travelStyleBadge,
        String bioNote
) {
}
