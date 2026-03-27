package org.example.backend.controller;

import org.example.backend.model.LikeEntity;
import org.example.backend.model.User;
import org.example.backend.service.ILikeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/like")
public class LikeController {

    @Autowired
    ILikeService likeService;

    @GetMapping("/allLikes")
    public List<LikeEntity> getAllLikes() {
        return likeService.retrieveAllLikes();
    }

    @PostMapping("/toggleLike/{postId}")
    public ResponseEntity<Map<String, Object>> toggleLike(@PathVariable Integer postId) {
        User currentUser = getCurrentUser();
        
        try {
            LikeEntity like = likeService.toggleLike(postId, currentUser.getUserId());
            boolean isLiked = like != null;
            
            Map<String, Object> response = new HashMap<>();
            response.put("liked", isLiked);
            response.put("like", like);
            response.put("message", isLiked ? "Post liked" : "Post unliked");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to toggle like: " + e.getMessage());
        }
    }

    @GetMapping("/isLiked/{postId}")
    public ResponseEntity<Map<String, Boolean>> isPostLikedByUser(@PathVariable Integer postId) {
        User currentUser = getCurrentUser();
        boolean isLiked = likeService.isPostLikedByUser(postId, currentUser.getUserId());
        
        Map<String, Boolean> response = new HashMap<>();
        response.put("liked", isLiked);
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/byPost/{postId}")
    public ResponseEntity<Map<String, Object>> getLikesByPost(@PathVariable Integer postId) {
        List<LikeEntity> likes = likeService.getLikesByPost(postId);
        User currentUser = getCurrentUser();
        boolean isLikedByCurrentUser = likeService.isPostLikedByUser(postId, currentUser.getUserId());
        
        // Extract user nicknames
        List<String> userNicknames = likes.stream()
                .map(like -> like.getUser().getUsername())
                .collect(java.util.stream.Collectors.toList());
        
        Map<String, Object> response = new HashMap<>();
        response.put("likes", likes);
        response.put("count", likes.size());
        response.put("isLikedByCurrentUser", isLikedByCurrentUser);
        response.put("userNicknames", userNicknames);
        
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/unlike/{postId}")
    public ResponseEntity<Map<String, String>> unlikePost(@PathVariable Integer postId) {
        User currentUser = getCurrentUser();
        
        try {
            likeService.unlikePost(postId, currentUser.getUserId());
            Map<String, String> response = new HashMap<>();
            response.put("message", "Post unliked successfully");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to unlike post: " + e.getMessage());
        }
    }
    
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        
        // Extract User entity from CustomUserDetails
        Object principal = authentication.getPrincipal();
        if (principal instanceof org.example.backend.service.CustomUserDetailsService.CustomUserDetails) {
            return ((org.example.backend.service.CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }
        
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication principal");
    }
}

