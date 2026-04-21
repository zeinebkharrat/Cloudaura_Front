package org.example.backend.dto;

import java.time.LocalDate;
import java.util.Set;

public record UserSummaryResponse(
        Integer id,
        String username,
        String email,
        String firstName,
        String lastName,
        String phone,
        String nationality,
        String gender,
        LocalDate dateOfBirth,
        Integer cityId,
        String cityName,
        Set<String> roles,
        String status,
        Boolean artisanRequestPending,
        String profileImageUrl,
        String coverImageUrl,
        Integer points,
        Double monthlyScore,
        Double lifetimeScore
) {
}
