package org.example.backend.controller;

import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.IPostService;
import org.example.backend.service.PostViewService;
import org.example.backend.service.SightengineCommentModerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/post")
public class PostController {

    @Autowired
    IPostService postService;

    @Autowired
    SightengineCommentModerationService moderationService;

    @Autowired
    PostViewService postViewService;

    @GetMapping("/allPosts")
    public List<Post> getAllPosts() {
        return postService.retrievePosts();
    }

    @PostMapping("/addPost")
    public Post addPost(@RequestBody Post post) {
        // Force the author to be the authenticated user
        User currentUser = getCurrentUser();
        post.setAuthor(currentUser);

        if (moderationService.containsProfanity(post.getContent())) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Post cannot be published because it contains bad words."
            );
        }

        if (post.getLocation() == null || post.getLocation().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.post_city_required");
        }

        Date now = new Date();
        post.setCreatedAt(now);
        post.setUpdatedAt(now);
        post.setHashtags(buildHashtagString(post.getHashtags(), post.getLocation()));
        if (post.getLikesCount() == null) {
            post.setLikesCount(0);
        }
        if (post.getCommentsCount() == null) {
            post.setCommentsCount(0);
        }
        if (post.getTotalViews() == null) {
            post.setTotalViews(0);
        }
        if (post.getRepostCount() == null) {
            post.setRepostCount(0);
        }
        if (post.getPostScore() == null) {
            post.setPostScore(1.0);
        }

        return postService.addPost(post);
    }

    @PutMapping("/updatePost/{id}")
    public Post updatePost(@PathVariable Integer id, @RequestBody Post post) {
        User currentUser = getCurrentUser();
        Post existingPost = postService.retrievePost(id);
        
        if (existingPost == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.post_not_found");
        }
        
        // Only allow users to update their own posts
        if (!existingPost.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.post_edit_forbidden");
        }

        if (post.getLocation() == null || post.getLocation().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.post_city_required");
        }
        
        // Preserve author + immutable create date, refresh update date, and keep server counters authoritative.
        post.setPostId(id);
        post.setAuthor(currentUser);
        post.setCreatedAt(existingPost.getCreatedAt());
        post.setUpdatedAt(new Date());
        post.setHashtags(buildHashtagString(post.getHashtags(), post.getLocation()));
        post.setLikesCount(existingPost.getLikesCount());
        post.setCommentsCount(existingPost.getCommentsCount());
        post.setTotalViews(existingPost.getTotalViews());
        post.setRepostCount(existingPost.getRepostCount());
        post.setPostScore(existingPost.getPostScore());
        post.setRepostOf(existingPost.getRepostOf());
        return postService.updatePost(post);
    }

    @PostMapping("/recordView/{id}")
    public ResponseEntity<Map<String, Object>> recordView(@PathVariable Integer id) {
        User currentUser = getCurrentUser();
        boolean counted = postViewService.recordMonthlyView(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("counted", counted));
    }

    @PostMapping("/repost/{id}")
    public ResponseEntity<?> repost(@PathVariable Integer id, @RequestBody(required = false) Map<String, String> payload) {
        User currentUser = getCurrentUser();
        String caption = payload != null ? payload.get("caption") : null;
        Post repost = postService.repost(id, currentUser.getUserId(), caption);
        if (repost == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Original post not found"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(repost);
    }

    @DeleteMapping("/deletePost/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Integer id) {
        User currentUser = getCurrentUser();
        Post existingPost = postService.retrievePost(id);
        
        if (existingPost == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.post_not_found");
        }
        
        // Only allow users to delete their own posts
        if (!existingPost.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.post_delete_forbidden");
        }
        
        postService.removePost(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/myPosts")
    public List<Post> getMyPosts() {
        User currentUser = getCurrentUser();
        return postService.findPostsByAuthor(currentUser.getUserId());
    }

    @GetMapping("/getPost/{id}")
    public Post getPost(@PathVariable Integer id) {
        return postService.retrievePost(id);
    }

    private String buildHashtagString(String existingHashtags, String cityName) {
        String normalizedCity = cityName == null
                ? ""
                : cityName.trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\s_\\-]+", "")
                .replaceAll("[^\\p{L}\\p{Nd}]", "");

        if (normalizedCity.isBlank()) {
            normalizedCity = "city";
        }

        String cityTag = "#" + normalizedCity;

        String base = existingHashtags == null ? "" : existingHashtags.trim();
        if (base.isEmpty()) {
            return cityTag;
        }
        if (base.contains(cityTag)) {
            return base;
        }
        return base + " " + cityTag;
    }
    
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.unauthorized");
        }
        
        // Extract User entity from CustomUserDetails
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails) {
            return ((CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }
        
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.invalid_principal");
    }
}

