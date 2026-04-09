package org.example.backend.controller;

import org.example.backend.model.Comment;
import org.example.backend.model.User;
import org.example.backend.service.ICommentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/comment")
public class CommentController {

    @Autowired
    ICommentService commentService;

    @GetMapping("/allComments")
    public List<Comment> getAllComments() {
        return commentService.retrieveAllComments();
    }

    @PostMapping("/addComment")
    public Comment addComment(@RequestBody Comment comment) {
        // Force the author to be the authenticated user
        User currentUser = getCurrentUser();
        comment.setAuthor(currentUser);
        Date now = new Date();
        comment.setCreatedAt(now);
        comment.setUpdatedAt(now);
        return commentService.addComment(comment);
    }

    @PutMapping("/updateComment/{id}")
    public Comment updateComment(@PathVariable Integer id, @RequestBody Comment comment) {
        User currentUser = getCurrentUser();
        Comment existingComment = commentService.retrieveComment(id);
        
        if (existingComment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found");
        }
        
        // Only allow users to update their own comments
        if (!existingComment.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit your own comments");
        }
        
        // Preserve author, post, parent, and timestamps
        comment.setCommentId(id);
        comment.setAuthor(currentUser);
        comment.setPost(existingComment.getPost());
        comment.setParent(existingComment.getParent());
        comment.setCreatedAt(existingComment.getCreatedAt());
        comment.setUpdatedAt(new Date());
        return commentService.updateComment(comment);
    }

    @DeleteMapping("/deleteComment/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable Integer id) {
        User currentUser = getCurrentUser();
        Comment existingComment = commentService.retrieveComment(id);
        
        if (existingComment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found");
        }
        
        // Only allow users to delete their own comments
        if (!existingComment.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own comments");
        }
        
        commentService.removeComment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/getComment/{id}")
    public Comment getComment(@PathVariable Integer id) {
        return commentService.retrieveComment(id);
    }
    
    @GetMapping("/byPost/{postId}")
    public List<Comment> getCommentsByPost(@PathVariable Integer postId) {
        return commentService.retrieveCommentsByPost(postId);
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

