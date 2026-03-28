package org.example.backend.repository;

import org.example.backend.model.SavedPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedPostRepository extends JpaRepository<SavedPost, Integer> {
    Optional<SavedPost> findByUserUserIdAndPostPostId(Integer userId, Integer postId);
    List<SavedPost> findByUserUserIdOrderByCreatedAtDesc(Integer userId);
    boolean existsByUserUserIdAndPostPostId(Integer userId, Integer postId);
    void deleteByPostPostId(Integer postId);
}
