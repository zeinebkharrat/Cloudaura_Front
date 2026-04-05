package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.model.User;
import org.example.backend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;

/**
 * Resolves application user id from JWT-backed {@link CustomUserDetailsService.CustomUserDetails}
 * or from session OAuth2 login (same email / synthetic email convention as {@link AuthService}).
 */
@Component
@RequiredArgsConstructor
public class UserIdentityResolver {

    private final UserRepository userRepository;

    public Integer resolveUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails details) {
            return details.getUser().getUserId();
        }
        if (principal instanceof OAuth2User oauth2User && authentication instanceof OAuth2AuthenticationToken token) {
            return resolveOAuth2UserId(oauth2User, token.getAuthorizedClientRegistrationId());
        }
        return null;
    }

    private Integer resolveOAuth2UserId(OAuth2User oauth2User, String registrationId) {
        String email = oauth2User.getAttribute("email");
        if (email != null && !email.isBlank()) {
            return findByEmail(email.trim());
        }
        String sub = Optional.ofNullable(oauth2User.getAttribute("sub")).map(Object::toString).orElse("");
        if (sub.isBlank() || registrationId == null || registrationId.isBlank()) {
            return null;
        }
        String synthetic = "social-" + sanitizeIdentifierPart(registrationId) + "-"
                + sanitizeIdentifierPart(sub) + "@oauth.local";
        return userRepository.findByEmailIgnoreCase(synthetic).map(User::getUserId).orElse(null);
    }

    private Integer findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email.trim()).map(User::getUserId).orElse(null);
    }

    private static String sanitizeIdentifierPart(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        String sanitized = normalized.replaceAll("[^a-z0-9._-]", "-").replaceAll("-+", "-");
        if (sanitized.startsWith("-")) {
            sanitized = sanitized.substring(1);
        }
        if (sanitized.endsWith("-")) {
            sanitized = sanitized.substring(0, sanitized.length() - 1);
        }
        return sanitized.isBlank() ? "social" : sanitized;
    }
}
