package org.example.backend.repository;

import org.example.backend.model.UserBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserBadgeRepository extends JpaRepository<UserBadge, Integer> {

    List<UserBadge> findByUser_UserIdOrderByEarnedAtDesc(Integer userId);

    boolean existsByUser_UserIdAndBadge_BadgeId(Integer userId, Integer badgeId);
}
