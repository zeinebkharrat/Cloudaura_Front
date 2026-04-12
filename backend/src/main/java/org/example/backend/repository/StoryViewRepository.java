package org.example.backend.repository;

import org.example.backend.model.StoryView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoryViewRepository extends JpaRepository<StoryView, Integer> {
    Optional<StoryView> findByStoryStoryIdAndViewerUserId(Integer storyId, Integer viewerUserId);
    long countByStoryStoryId(Integer storyId);
    List<StoryView> findByStoryStoryIdOrderByViewedAtDesc(Integer storyId);
}
