package org.example.backend.controller;

import org.example.backend.dto.PassportPhotoCreateRequest;
import org.example.backend.dto.PassportProfileUpdateRequest;
import org.example.backend.dto.PassportResponse;
import org.example.backend.dto.PassportStampUpsertRequest;
import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.IUserDigitalPassPortService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping({"/api/passport", "/passport"})
public class UserDigitalPassPortController {

    private final IUserDigitalPassPortService passportService;

    public UserDigitalPassPortController(IUserDigitalPassPortService passportService) {
        this.passportService = passportService;
    }

    @GetMapping("/me")
    public PassportResponse getMyPassport() {
        User currentUser = getCurrentUser();
        return passportService.getMyPassport(currentUser.getUserId());
    }

    @GetMapping("/user/{userId}")
    public PassportResponse getPassportByUserId(@PathVariable Integer userId) {
        return passportService.getPassportByUserId(userId);
    }

    @PutMapping("/me/profile")
    public PassportResponse updateMyPassportProfile(@RequestBody PassportProfileUpdateRequest request) {
        User currentUser = getCurrentUser();
        return passportService.updateMyPassportProfile(currentUser.getUserId(), request);
    }

    @PostMapping("/me/stamps")
    public ResponseEntity<PassportResponse> addOrUpdateStamp(@RequestBody PassportStampUpsertRequest request) {
        User currentUser = getCurrentUser();
        PassportResponse response = passportService.addOrUpdateStamp(currentUser.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/me/stamps/{stampId}")
    public PassportResponse deleteStamp(@PathVariable Integer stampId) {
        User currentUser = getCurrentUser();
        return passportService.deleteStamp(currentUser.getUserId(), stampId);
    }

    @PostMapping("/me/photos")
    public ResponseEntity<PassportResponse> addPhoto(@RequestBody PassportPhotoCreateRequest request) {
        User currentUser = getCurrentUser();
        PassportResponse response = passportService.addPhoto(currentUser.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/me/photos/{photoId}")
    public PassportResponse deletePhoto(@PathVariable Integer photoId) {
        User currentUser = getCurrentUser();
        return passportService.deletePhoto(currentUser.getUserId(), photoId);
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails) {
            return ((CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication principal");
    }
}
