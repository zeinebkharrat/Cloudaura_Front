package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.AuthResponse;
import org.example.backend.dto.LoginRequest;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    @Value("${app.oauth2.google-client-id}")
    private String googleClientId;

    @Value("${app.oauth2.github-client-id}")
    private String githubClientId;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
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
        boolean googleConfigured = googleClientId != null
            && !googleClientId.isBlank()
            && !googleClientId.startsWith("dummy-");
        boolean githubConfigured = githubClientId != null
            && !githubClientId.isBlank()
            && !githubClientId.startsWith("dummy-");
        return new SocialProvidersResponse(googleConfigured, githubConfigured);
    }
}
