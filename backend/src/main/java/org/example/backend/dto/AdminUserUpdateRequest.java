package org.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminUserUpdateRequest(
        @NotBlank(message = "First name is required")
        @Size(max = 50)
        String firstName,
        @NotBlank(message = "Last name is required")
        @Size(max = 50)
        String lastName,
        @NotBlank(message = "Email is required")
        @Email(message = "Email format is invalid")
        String email,
        @Size(max = 20)
        String phone,
        @Size(max = 100)
        String nationality,
        Integer cityId,
        @Size(max = 100000)
        String profileImageUrl,
        @NotBlank(message = "Status is required")
        String status
) {
}
