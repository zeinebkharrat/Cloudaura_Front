package org.example.backend.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.Set;

public record AdminUserRoleUpdateRequest(
        @NotEmpty(message = "At least one role must be selected")
        Set<String> roles
) {
}
