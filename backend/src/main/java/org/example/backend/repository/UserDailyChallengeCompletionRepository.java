package org.example.backend.repository;

import org.example.backend.model.UserDailyChallengeCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserDailyChallengeCompletionRepository
        extends JpaRepository<UserDailyChallengeCompletion, Integer> {

    boolean existsByUser_UserIdAndChallenge_ChallengeId(Integer userId, Integer challengeId);

    List<UserDailyChallengeCompletion> findByUser_UserIdOrderByCompletedAtDesc(Integer userId);
}
