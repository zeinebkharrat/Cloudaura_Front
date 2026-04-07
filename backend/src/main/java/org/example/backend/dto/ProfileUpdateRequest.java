package org.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @NotBlank(message = "First name is required")
        @Size(min = 2, max = 50, message = "First name must be between 2 and 50 characters")
        String firstName,
        @NotBlank(message = "Last name is required")
        @Size(min = 2, max = 50, message = "Last name must be between 2 and 50 characters")
        String lastName,
        @NotBlank(message = "Email is required")
        @Email(message = "Email format is invalid")
        String email,
        @Size(max = 50, message = "Phone must not exceed 50 characters")
        String phone,
        @Size(max = 100, message = "Nationality is too long")
        String nationality,
        Integer cityId,
        /** URLs hébergées ou data URLs (base64) ; aligné sur MEDIUMTEXT côté base. */
        @Size(max = 16_000_000, message = "Profile image URL is too long")
        String profileImageUrl
) {
}
