package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.AuthMessageResponse;
import org.example.backend.dto.AuthResponse;
import org.example.backend.dto.ForgotPasswordRequest;
import org.example.backend.dto.LoginRequest;
import org.example.backend.dto.ResendVerificationRequest;
import org.example.backend.dto.ResetPasswordRequest;
import org.example.backend.dto.SignupRequest;
import org.example.backend.dto.SocialProvidersResponse;
import org.example.backend.dto.UserSummaryResponse;
import org.example.backend.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    @Value("${app.oauth2.google-client-id}")
    private String googleClientId;

    @Value("${app.oauth2.google-client-secret}")
    private String googleClientSecret;

    @Value("${app.oauth2.github-client-id}")
    private String githubClientId;

    @Value("${app.oauth2.github-client-secret}")
    private String githubClientSecret;

    @Value("${app.oauth2.facebook-client-id}")
    private String facebookClientId;

    @Value("${app.oauth2.facebook-client-secret}")
    private String facebookClientSecret;

    @Value("${app.oauth2.instagram-client-id}")
    private String instagramClientId;

    @Value("${app.oauth2.instagram-client-secret}")
    private String instagramClientSecret;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthMessageResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    @PostMapping("/signin")
    public AuthResponse signin(@Valid @RequestBody LoginRequest request) {
        return authService.signin(request);
    }

    @GetMapping("/me")
    public UserSummaryResponse me() {
        return authService.me();
    }

    @GetMapping("/social/providers")
    public SocialProvidersResponse socialProviders() {
        boolean googleConfigured = isConfigured(googleClientId, googleClientSecret);
        boolean githubConfigured = isConfigured(githubClientId, githubClientSecret);
        boolean facebookConfigured = isConfigured(facebookClientId, facebookClientSecret);
        boolean instagramConfigured = isConfigured(instagramClientId, instagramClientSecret);
        return new SocialProvidersResponse(googleConfigured, githubConfigured, facebookConfigured, instagramConfigured);
    }

    private boolean isConfigured(String clientId, String clientSecret) {
        return clientId != null
            && clientSecret != null
            && !clientId.isBlank()
            && !clientSecret.isBlank()
            && !clientId.startsWith("disabled-")
            && !clientSecret.startsWith("disabled-");
    }

    @GetMapping("/verify-email")
    public AuthMessageResponse verifyEmail(@RequestParam("token") String token) {
        return authService.verifyEmail(token);
    }

    @PostMapping("/resend-verification")
    public AuthMessageResponse resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        return authService.resendVerification(request);
    }

    @PostMapping("/forgot-password")
    public AuthMessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return authService.forgotPassword(request);
    }

    @PostMapping("/reset-password")
    public AuthMessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }
}
