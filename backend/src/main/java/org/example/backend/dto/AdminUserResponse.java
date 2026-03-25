package org.example.backend.dto;

import java.util.Set;

public record AdminUserResponse(
        Integer id,
        String username,
        String email,
        String firstName,
        String lastName,
        String phone,
        String status,
        Boolean artisanRequestPending,
        Set<String> roles
) {
}
