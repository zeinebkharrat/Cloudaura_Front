package org.example.backend.repository;

import org.example.backend.model.PassportAchievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PassportAchievementRepository extends JpaRepository<PassportAchievement, Integer> {
    List<PassportAchievement> findByPassportPassportIdOrderByUnlockedAtDesc(Integer passportId);

    Optional<PassportAchievement> findByPassportPassportIdAndAchievementCode(Integer passportId, String achievementCode);
}
