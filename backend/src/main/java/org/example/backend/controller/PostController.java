package org.example.backend.controller;

import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.IPostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/post")
public class PostController {

    @Autowired
    IPostService postService;

    @GetMapping("/allPosts")
    public List<Post> getAllPosts() {
        return postService.retrievePosts();
    }

    @PostMapping("/addPost")
    public Post addPost(@RequestBody Post post) {
        // Force the author to be the authenticated user
        User currentUser = getCurrentUser();
        post.setAuthor(currentUser);
        return postService.addPost(post);
    }

    @PutMapping("/updatePost/{id}")
    public Post updatePost(@PathVariable Integer id, @RequestBody Post post) {
        User currentUser = getCurrentUser();
        Post existingPost = postService.retrievePost(id);
        
        if (existingPost == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        
        // Only allow users to update their own posts
        if (!existingPost.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own posts");
        }
        
        // Preserve author and timestamps
        post.setPostId(id);
        post.setAuthor(currentUser);
        return postService.updatePost(post);
    }

    @DeleteMapping("/deletePost/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Integer id) {
        User currentUser = getCurrentUser();
        Post existingPost = postService.retrievePost(id);
        
        if (existingPost == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        
        // Only allow users to delete their own posts
        if (!existingPost.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own posts");
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
    
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        
        // Extract User entity from CustomUserDetails
        Object principal = authentication.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails) {
            return ((CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }
        
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication principal");
    }
}

