package org.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

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
        @Size(max = 16_000_000, message = "Profile image URL is too long")
        String profileImageUrl,
        /** Google reCAPTCHA v2 response; required when {@code app.recaptcha.secret} is set. */
        String captchaToken
) {
    /**
     * Normalise les entrées avant la validation Bean Validation (espaces, e-mail en minuscules).
     * Le mot de passe n'est pas trimé volontairement.
     */
    public SignupRequest {
        if (username != null) {
            username = username.trim();
        }
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
        if (phone != null) {
            String p = phone.trim();
            phone = p.isEmpty() ? null : p;
        }
        if (firstName != null) {
            firstName = firstName.trim();
        }
        if (lastName != null) {
            lastName = lastName.trim();
        }
        if (nationality != null) {
            String n = nationality.trim();
            nationality = n.isEmpty() ? null : n;
        }
        if (profileImageUrl != null) {
            String u = profileImageUrl.trim();
            profileImageUrl = u.isEmpty() ? null : u;
        }
        if (captchaToken != null) {
            String t = captchaToken.trim();
            captchaToken = t.isEmpty() ? null : t;
        }
    }
}
