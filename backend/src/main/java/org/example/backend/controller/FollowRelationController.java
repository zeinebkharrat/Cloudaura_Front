package org.example.backend.controller;

import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.FollowRelationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/follow")
public class FollowRelationController {

    private final FollowRelationService followRelationService;

    public FollowRelationController(FollowRelationService followRelationService) {
        this.followRelationService = followRelationService;
    }

    @PostMapping("/toggle/{targetUserId}")
    public ResponseEntity<Map<String, Object>> toggleFollow(@PathVariable Integer targetUserId) {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(followRelationService.toggleFollow(currentUser.getUserId(), targetUserId));
    }

    @GetMapping("/is-following/{targetUserId}")
    public ResponseEntity<Map<String, Object>> isFollowing(@PathVariable Integer targetUserId) {
        User currentUser = getCurrentUser();
        boolean following = followRelationService.isFollowing(currentUser.getUserId(), targetUserId);
        return ResponseEntity.ok(Map.of("following", following));
    }

    @GetMapping("/followers/{userId}")
    public ResponseEntity<Map<String, Object>> followers(@PathVariable Integer userId) {
        return ResponseEntity.ok(Map.of("count", followRelationService.followersOf(userId).size()));
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
