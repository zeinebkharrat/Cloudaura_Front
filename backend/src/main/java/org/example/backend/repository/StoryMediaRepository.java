package org.example.backend.repository;

import org.example.backend.model.StoryMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoryMediaRepository extends JpaRepository<StoryMedia, Integer> {
    List<StoryMedia> findByStoryStoryIdOrderByOrderIndexAsc(Integer storyId);
}
