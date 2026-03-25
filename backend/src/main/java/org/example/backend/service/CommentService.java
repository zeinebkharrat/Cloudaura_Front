package org.example.backend.service;

import org.example.backend.model.Comment;
import org.example.backend.repository.CommentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CommentService implements ICommentService {

    @Autowired
    CommentRepository commentRepo;

    @Override
    public List<Comment> retrieveAllComments() {
        return commentRepo.findAll();
    }

    @Override
    public Comment addComment(Comment comment) {
        return commentRepo.save(comment);
    }

    @Override
    public Comment updateComment(Comment comment) {
        return commentRepo.save(comment);
    }

    @Override
    public Comment retrieveComment(Integer commentId) {
        return commentRepo.findById(commentId).orElse(null);
    }

    @Override
    public void removeComment(Integer commentId) {
        commentRepo.deleteById(commentId);
    }
}
