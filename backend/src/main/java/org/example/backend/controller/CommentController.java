package org.example.backend.controller;

import org.example.backend.model.Comment;
import org.example.backend.service.ICommentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
        return commentService.addComment(comment);
    }

    @PutMapping("/updateComment")
    public Comment updateComment(@RequestBody Comment comment) {
        return commentService.updateComment(comment);
    }

    @DeleteMapping("/deleteComment/{id}")
    public void deleteComment(@PathVariable Integer id) {
        commentService.removeComment(id);
    }

    @GetMapping("/getComment/{id}")
    public Comment getComment(@PathVariable Integer id) {
        return commentService.retrieveComment(id);
    }
}

