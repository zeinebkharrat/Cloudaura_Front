package org.example.backend.dto.publicapi;

public record ActivityAvailabilityDayResponse(
    String date,
    Integer maxParticipantsPerDay,
    Integer reservedParticipants,
    Integer remainingParticipants,
    boolean available
) {
}
