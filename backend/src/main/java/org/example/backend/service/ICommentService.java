package org.example.backend.service;

import org.example.backend.model.Comment;

import java.util.List;

public interface ICommentService {
    List<Comment> retrieveAllComments();
    Comment addComment(Comment comment);
    Comment updateComment(Comment comment);
    Comment retrieveComment(Integer commentId);
    void removeComment(Integer commentId);
    
    // New JWT-authenticated method
    List<Comment> retrieveCommentsByPost(Integer postId);
}