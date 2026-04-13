package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.ChangePasswordRequest;
import org.example.backend.dto.ProfileUpdateRequest;
import org.example.backend.dto.RevokeOtherSessionsResponse;
import org.example.backend.dto.UserSummaryResponse;
import org.example.backend.dto.UserSessionResponse;
import org.example.backend.service.AuthService;
import org.example.backend.service.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final AuthService authService;
    private final JwtService jwtService;

    public ProfileController(AuthService authService, JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    @GetMapping
    public UserSummaryResponse profile() {
        return authService.me();
    }

    @PutMapping
    public UserSummaryResponse updateProfile(@Valid @RequestBody ProfileUpdateRequest request) {
        return authService.updateProfile(request);
    }

    @PatchMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
    }

    @GetMapping("/sessions")
    public List<UserSessionResponse> sessions(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        return authService.mySessions(extractCurrentSessionId(authorizationHeader));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeSession(@PathVariable String sessionId,
                              @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        authService.revokeSession(sessionId, extractCurrentSessionId(authorizationHeader));
    }

    @DeleteMapping("/sessions/revoke-others")
    public RevokeOtherSessionsResponse revokeOtherSessions(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        return authService.revokeOtherSessions(extractCurrentSessionId(authorizationHeader));
    }

    private String extractCurrentSessionId(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authorizationHeader.substring(7);
        try {
            return jwtService.extractSessionId(token);
        } catch (Exception ex) {
            return null;
        }
    }
}
