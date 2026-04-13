package org.example.backend.controller;

import org.example.backend.model.User;
import org.example.backend.repository.UserRepository;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.FollowRelationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/follow")
public class FollowRelationController {

    private final FollowRelationService followRelationService;
    private final UserRepository userRepository;

    public FollowRelationController(FollowRelationService followRelationService, UserRepository userRepository) {
        this.followRelationService = followRelationService;
        this.userRepository = userRepository;
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
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("count", followRelationService.followersCount(userId));
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/following/{userId}")
    public ResponseEntity<Map<String, Object>> following(@PathVariable Integer userId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("count", followRelationService.followingCount(userId));
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/followers-list/{userId}")
    public ResponseEntity<Map<String, Object>> followersList(@PathVariable Integer userId) {
        List<Map<String, Object>> users = followRelationService.followersOf(userId)
                .stream()
                .map(relation -> toUserSummary(relation.getFollower()))
                .filter(summary -> summary.get("userId") != null)
                .toList();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("users", users == null ? new ArrayList<>() : users);
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/following-list/{userId}")
    public ResponseEntity<Map<String, Object>> followingList(@PathVariable Integer userId) {
        List<Map<String, Object>> users = followRelationService.followingOf(userId)
                .stream()
                .map(relation -> toUserSummary(relation.getFollowed()))
                .filter(summary -> summary.get("userId") != null)
                .collect(Collectors.toList());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("users", users == null ? new ArrayList<>() : users);
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/user-summary/{userId}")
    public ResponseEntity<Map<String, Object>> userSummary(@PathVariable Integer userId) {
        User user = userRepository.findByIdWithCity(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", user.getUserId());
        payload.put("username", user.getUsername() == null ? "" : user.getUsername());
        payload.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
        payload.put("lastName", user.getLastName() == null ? "" : user.getLastName());
        payload.put("profileImageUrl", user.getProfileImageUrl() == null ? "" : user.getProfileImageUrl());
        String nationality = user.getNationality() == null ? "" : user.getNationality();
        payload.put("country", nationality);
        payload.put("nationality", nationality);
        payload.put("cityName", user.getCity() != null ? user.getCity().getName() : "");
        payload.put("age", null);
        payload.put("followersCount", followRelationService.followersCount(userId));
        payload.put("followingCount", followRelationService.followingCount(userId));
        return ResponseEntity.ok(payload);
    }

    private Map<String, Object> toUserSummary(User user) {
        Map<String, Object> summary = new LinkedHashMap<>();
        if (user == null) {
            summary.put("userId", null);
            summary.put("username", "");
            summary.put("firstName", "");
            summary.put("lastName", "");
            summary.put("profileImageUrl", "");
            return summary;
        }

        summary.put("userId", user.getUserId());
        summary.put("username", user.getUsername() == null ? "" : user.getUsername());
        summary.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
        summary.put("lastName", user.getLastName() == null ? "" : user.getLastName());
        summary.put("profileImageUrl", user.getProfileImageUrl() == null ? "" : user.getProfileImageUrl());
        return summary;
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
