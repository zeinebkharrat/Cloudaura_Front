package org.example.backend.dto;

import java.util.Set;

public record UserSummaryResponse(
        Integer id,
        String username,
        String email,
        String firstName,
        String lastName,
        String phone,
        String nationality,
        Integer cityId,
        String cityName,
        Set<String> roles,
        String status,
        Boolean artisanRequestPending,
        String profileImageUrl,
        Integer points
) {
}
