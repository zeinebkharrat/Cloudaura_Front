package org.example.backend.controller;

import org.example.backend.dto.StoryInteractionUserResponse;
import org.example.backend.dto.StoryResponse;
import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.IStoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/story")
public class StoryController {

    private final IStoryService storyService;

    public StoryController(IStoryService storyService) {
        this.storyService = storyService;
    }

    @PostMapping(value = "/add", consumes = {"multipart/form-data"})
    public ResponseEntity<StoryResponse> addStory(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "mediaType", required = false) String mediaType
    ) {
        User user = getCurrentUser();
        StoryResponse created = storyService.createStory(user.getUserId(), file, caption, visibility, mediaType);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/feed")
    public List<StoryResponse> getFeedStories() {
        User user = resolveCurrentUserOrNull();
        return storyService.getFeedStories(user != null ? user.getUserId() : null);
    }

    @GetMapping("/my")
    public List<StoryResponse> getMyStories() {
        User user = getCurrentUser();
        return storyService.getMyStories(user.getUserId());
    }

    @GetMapping("/archive")
    public List<StoryResponse> getMyArchive() {
        User user = getCurrentUser();
        return storyService.getMyArchive(user.getUserId());
    }

    @PostMapping("/view/{storyId}")
    public StoryResponse markViewed(@PathVariable Integer storyId) {
        User user = getCurrentUser();
        return storyService.markViewed(storyId, user.getUserId());
    }

    @PostMapping("/like/{storyId}")
    public StoryResponse likeStory(@PathVariable Integer storyId) {
        User user = getCurrentUser();
        return storyService.likeStory(storyId, user.getUserId());
    }

    @DeleteMapping("/like/{storyId}")
    public StoryResponse unlikeStory(@PathVariable Integer storyId) {
        User user = getCurrentUser();
        return storyService.unlikeStory(storyId, user.getUserId());
    }

    @GetMapping("/viewers/{storyId}")
    public List<StoryInteractionUserResponse> getStoryViewers(@PathVariable Integer storyId) {
        User user = getCurrentUser();
        return storyService.getStoryViewers(storyId, user.getUserId());
    }

    @GetMapping("/likers/{storyId}")
    public List<StoryInteractionUserResponse> getStoryLikers(@PathVariable Integer storyId) {
        User user = getCurrentUser();
        return storyService.getStoryLikers(storyId, user.getUserId());
    }

    @DeleteMapping("/delete/{storyId}")
    public ResponseEntity<Void> deleteStory(@PathVariable Integer storyId) {
        User user = getCurrentUser();
        storyService.deleteStory(storyId, user.getUserId());
        return ResponseEntity.noContent().build();
    }

    private User getCurrentUser() {
        User user = resolveCurrentUserOrNull();
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        return user;
    }

    private User resolveCurrentUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails details) {
            return details.getUser();
        }
        return null;
    }
}
