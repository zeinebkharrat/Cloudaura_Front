package org.example.backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.DailyChallenge;
import org.example.backend.model.LudificationGameKind;
import org.example.backend.repository.DailyChallengeRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DailyChallengeCleanupScheduler {

    private final DailyChallengeRepository dailyChallengeRepository;
    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "${daily.challenge.cleanup.cron:0 0 * * * *}") // Runs every hour by default
    @Transactional
    public void cleanupExpiredChallenges() {
        log.info("Starting cleanup of expired daily challenges...");
        Date now = new Date();
        
        List<DailyChallenge> allChallenges = dailyChallengeRepository.findAll();
        int deletedCount = 0;
        
        for (DailyChallenge challenge : allChallenges) {
            if (challenge.getValidTo() != null && challenge.getValidTo().before(now)) {
                // Determine target to delete if applicable
                if (LudificationGameKind.QUIZ.equals(challenge.getGameKind()) && challenge.getTargetId() != null) {
                    try {
                        Integer quizId = challenge.getTargetId();
                        jdbcTemplate.update("DELETE FROM user_game_sessions WHERE quiz_id = ?", quizId);
                        jdbcTemplate.update("DELETE FROM quiz_questions WHERE quiz_id = ?", quizId);
                        jdbcTemplate.update("DELETE FROM quizzes WHERE quiz_id = ?", quizId);
                        jdbcTemplate.update("DELETE FROM user_notifications WHERE type = 'GAME' AND title = 'New Daily Challenge'");
                        log.info("Deleted associated quiz with ID: {}", quizId);
                    } catch (Exception e) {
                        log.error("Failed to delete associated quiz for daily challenge {}", challenge.getChallengeId(), e);
                    }
                }
                
                // Delete the daily challenge itself
                dailyChallengeRepository.delete(challenge);
                deletedCount++;
            }
        }
        
        log.info("Completed cleanup. Deleted {} expired daily challenges.", deletedCount);
    }
}
