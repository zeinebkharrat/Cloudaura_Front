package org.example.backend.dto;

import java.util.Date;
import java.util.Set;

public record AdminUserResponse(
        Integer id,
        String username,
        String email,
        String firstName,
        String lastName,
        String phone,
        String nationality,
        Integer cityId,
        String cityName,
        String status,
        Boolean artisanRequestPending,
        Set<String> roles,
        String profileImageUrl,
        Boolean banned,
        String banReason,
        Date banExpiresAt
) {
}
