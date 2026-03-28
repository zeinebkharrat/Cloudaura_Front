package org.example.backend.repository;

import org.example.backend.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post,Integer> {
    List<Post> findByAuthorUserId(Integer authorId);
    List<Post> findByAuthorUserIdOrderByCreatedAtDesc(Integer authorId);
}
