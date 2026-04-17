package org.example.backend.repository;

import org.example.backend.model.PostView;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostViewRepository extends JpaRepository<PostView, Integer> {
    boolean existsByUserUserIdAndPostPostIdAndMonthKey(Integer userId, Integer postId, String monthKey);
}
