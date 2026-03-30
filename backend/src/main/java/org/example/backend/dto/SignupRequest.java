package org.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
        String username,
        @NotBlank(message = "Email is required")
        @Email(message = "Email format is invalid")
        String email,
        @Size(max = 50, message = "Phone must not exceed 50 characters")
        String phone,
        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
        String password,
        @NotBlank(message = "First name is required")
        @Size(min = 2, max = 50, message = "First name must be between 2 and 50 characters")
        String firstName,
        @NotBlank(message = "Last name is required")
        @Size(min = 2, max = 50, message = "Last name must be between 2 and 50 characters")
        String lastName,
        Boolean becomeArtisan,
        @Size(max = 100, message = "Nationality is too long")
        String nationality,
        Integer cityId,
        @Size(max = 100000, message = "Profile image URL is too long")
        String profileImageUrl
) {
}
