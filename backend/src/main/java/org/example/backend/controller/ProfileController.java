package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.ChangePasswordRequest;
import org.example.backend.dto.ProfileUpdateRequest;
import org.example.backend.dto.UserSummaryResponse;
import org.example.backend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final AuthService authService;

    public ProfileController(AuthService authService) {
        this.authService = authService;
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
}
