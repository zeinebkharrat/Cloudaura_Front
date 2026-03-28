package org.example.backend.repository;

import org.example.backend.model.FollowRelation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FollowRelationRepository extends JpaRepository<FollowRelation, Integer> {
    Optional<FollowRelation> findByFollowerUserIdAndFollowedUserId(Integer followerId, Integer followedId);
    List<FollowRelation> findByFollowedUserId(Integer userId);
    List<FollowRelation> findByFollowerUserId(Integer userId);
    long countByFollowedUserId(Integer userId);
    long countByFollowerUserId(Integer userId);
    boolean existsByFollowerUserIdAndFollowedUserId(Integer followerId, Integer followedId);
}
