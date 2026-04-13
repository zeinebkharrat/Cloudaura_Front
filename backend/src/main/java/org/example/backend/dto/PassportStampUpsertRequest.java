package org.example.backend.dto;

import java.util.Date;

public record PassportStampUpsertRequest(
        Integer cityId,
        Date visitedAt,
        String emblemKey,
        String memoryNote,
        String photoUrl
) {
}
