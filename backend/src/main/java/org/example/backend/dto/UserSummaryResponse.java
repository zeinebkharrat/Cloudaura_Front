package org.example.backend.dto;

import java.util.Set;

public record UserSummaryResponse(
        Integer id,
        String username,
        String email,
        String firstName,
        String lastName,
        Set<String> roles
) {
}
