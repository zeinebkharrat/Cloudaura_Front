package org.example.backend.repository;

import org.example.backend.model.Story;
import org.example.backend.model.StoryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Date;
import java.util.List;
import java.util.Optional;

public interface StoryRepository extends JpaRepository<Story, Integer> {

    @Query("SELECT DISTINCT s FROM Story s " +
            "LEFT JOIN FETCH s.author " +
            "LEFT JOIN FETCH s.medias " +
            "WHERE s.status = org.example.backend.model.StoryStatus.ACTIVE " +
            "AND s.expiresAt > :now " +
            "ORDER BY s.createdAt DESC, s.storyId DESC")
    List<Story> findActiveFeedWithGraph(@Param("now") Date now);

    @Query("SELECT DISTINCT s FROM Story s " +
            "LEFT JOIN FETCH s.author " +
            "LEFT JOIN FETCH s.medias " +
            "WHERE s.author.userId = :userId " +
            "ORDER BY s.createdAt DESC, s.storyId DESC")
    List<Story> findByAuthorWithGraph(@Param("userId") Integer userId);

    @Query("SELECT DISTINCT s FROM Story s " +
            "LEFT JOIN FETCH s.author " +
            "LEFT JOIN FETCH s.medias " +
            "WHERE s.storyId = :storyId")
    Optional<Story> findByIdWithGraph(@Param("storyId") Integer storyId);

    List<Story> findByStatusAndExpiresAtBefore(StoryStatus status, Date now);
}
