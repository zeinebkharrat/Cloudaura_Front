package org.example.backend.repository;

import org.example.backend.model.Ban;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BanRepository extends JpaRepository<Ban, Integer> {
    Optional<Ban> findTopByUserAndIsActiveTrueOrderByCreatedAtDesc(User user);
}
