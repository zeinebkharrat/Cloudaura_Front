package org.example.backend.controller;

import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.UserRoadmapCompletionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/ludification/roadmap")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class UserRoadmapCompletionController {

    private final UserRoadmapCompletionService completionService;

    public UserRoadmapCompletionController(UserRoadmapCompletionService completionService) {
        this.completionService = completionService;
    }

    @GetMapping("/progress")
    public ResponseEntity<Map<String, Object>> getRoadmapProgress() {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(completionService.getProgress(currentUser));
    }

    @GetMapping("/nodes/{nodeId}/can-play")
    public ResponseEntity<Map<String, Object>> canPlayRoadmapNode(
            @PathVariable Integer nodeId) {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(completionService.canPlay(currentUser, nodeId));
    }

    @PostMapping("/nodes/{nodeId}/complete")
    public ResponseEntity<Map<String, Object>> completeRoadmapNode(
            @PathVariable Integer nodeId, @RequestBody(required = false) Map<String, Object> body) {
        User currentUser = getCurrentUser();
        Map<String, Object> result = completionService.complete(currentUser, nodeId, body);
        return ResponseEntity.ok(result);
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
