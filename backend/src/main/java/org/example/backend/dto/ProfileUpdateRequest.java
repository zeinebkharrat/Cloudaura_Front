package org.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

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
        @Size(max = 20, message = "Phone must not exceed 20 characters")
        @Pattern(
                regexp = "^$|^\\+216[0-9]{8}$|^[0-9]{8}$",
                message = "Phone must be 8 digits or +216 followed by 8 digits")
        String phone,
        @Size(max = 100, message = "Nationality is too long")
        String nationality,
        @Pattern(regexp = "^(?i)(male|female)$", message = "Gender must be male or female")
        String gender,
        LocalDate dateOfBirth,
        Integer cityId,
        /** URLs hébergées ou data URLs (base64) ; aligné sur MEDIUMTEXT côté base. */
        @Size(max = 16_000_000, message = "Profile image URL is too long")
        String profileImageUrl,
        @Size(max = 16_000_000, message = "Cover image URL is too long")
        String coverImageUrl
) {
}
