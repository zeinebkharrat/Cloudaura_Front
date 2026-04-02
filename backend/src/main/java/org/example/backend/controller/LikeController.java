package org.example.backend.controller;

import org.example.backend.model.LikeEntity;
import org.example.backend.model.User;
import org.example.backend.service.ILikeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
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
            response.put("count", likeService.getLikesByPost(postId).size());
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
        User current = resolveCurrentUserOrNull();
        Integer uid = current != null ? current.getUserId() : null;
        return ResponseEntity.ok(likeService.getLikesByPostApiPayload(postId, uid));
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
        User u = resolveCurrentUserOrNull();
        if (u == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        return u;
    }

    /** Null when anonymous or not logged in — used for public GET endpoints. */
    private User resolveCurrentUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        if (authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if ("anonymousUser".equals(principal)) {
            return null;
        }
        if (principal instanceof org.example.backend.service.CustomUserDetailsService.CustomUserDetails details) {
            return details.getUser();
        }
        return null;
    }
}

