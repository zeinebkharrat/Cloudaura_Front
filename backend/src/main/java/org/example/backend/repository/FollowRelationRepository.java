package org.example.backend.repository;

import org.example.backend.model.FollowRelation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Date;
import java.util.List;
import java.util.Optional;

public interface FollowRelationRepository extends JpaRepository<FollowRelation, Integer> {
    Optional<FollowRelation> findByFollowerUserIdAndFollowedUserId(Integer followerId, Integer followedId);
    List<FollowRelation> findByFollowedUserId(Integer userId);
    List<FollowRelation> findByFollowerUserId(Integer userId);
    long countByFollowedUserId(Integer userId);
    long countByFollowerUserId(Integer userId);
    boolean existsByFollowerUserIdAndFollowedUserId(Integer followerId, Integer followedId);

    @Query("SELECT COUNT(fr) FROM FollowRelation fr WHERE fr.followed.userId = :userId AND fr.createdAt >= :start AND fr.createdAt < :end")
    long countFollowersForMonth(
            @Param("userId") Integer userId,
            @Param("start") Date start,
            @Param("end") Date end
    );
}
