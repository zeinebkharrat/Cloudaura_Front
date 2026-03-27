package org.example.backend.repository;

import org.example.backend.model.Comment;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Integer> {
    List<Comment> findByPost(Post post);
    List<Comment> findByAuthor(User user);
    List<Comment> findByPostOrderByCreatedAtAsc(Post post);
}

