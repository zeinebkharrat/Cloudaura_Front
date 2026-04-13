package org.example.backend.repository;

import org.example.backend.model.StoryLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoryLikeRepository extends JpaRepository<StoryLike, Integer> {
    Optional<StoryLike> findByStoryStoryIdAndLikerUserId(Integer storyId, Integer likerUserId);
    long countByStoryStoryId(Integer storyId);
    List<StoryLike> findByStoryStoryIdOrderByLikedAtDesc(Integer storyId);
}
