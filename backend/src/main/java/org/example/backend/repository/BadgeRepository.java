package org.example.backend.repository;

import org.example.backend.model.Badge;
import org.example.backend.model.LudificationGameKind;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BadgeRepository extends JpaRepository<Badge, Integer> {
    List<Badge> findByTargetGameIdAndTargetGameKind(String targetGameId, String targetGameKind);
}
