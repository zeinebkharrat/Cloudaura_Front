package org.example.backend.controller;

import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.SavedPostService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/saved-post")
public class SavedPostController {

    private final SavedPostService savedPostService;

    public SavedPostController(SavedPostService savedPostService) {
        this.savedPostService = savedPostService;
    }

    @PostMapping("/toggle/{postId}")
    public ResponseEntity<Map<String, Object>> toggleSave(@PathVariable Integer postId) {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(savedPostService.toggleSave(currentUser.getUserId(), postId));
    }

    @GetMapping("/my")
    public ResponseEntity<?> mySavedPosts() {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(savedPostService.getSavedPosts(currentUser.getUserId()));
    }

    @GetMapping("/is-saved/{postId}")
    public ResponseEntity<Map<String, Object>> isSaved(@PathVariable Integer postId) {
        User currentUser = getCurrentUser();
        boolean saved = savedPostService.isSaved(currentUser.getUserId(), postId);
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.unauthorized");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails) {
            return ((CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.invalid_principal");
    }
}
