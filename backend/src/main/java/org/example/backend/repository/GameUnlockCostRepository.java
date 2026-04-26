package org.example.backend.repository;

import org.example.backend.model.GameUnlockCost;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameUnlockCostRepository extends JpaRepository<GameUnlockCost, String> {
}
