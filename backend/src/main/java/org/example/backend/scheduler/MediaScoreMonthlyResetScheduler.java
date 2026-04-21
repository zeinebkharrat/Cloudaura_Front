package org.example.backend.scheduler;

import org.example.backend.service.MediaScoreService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MediaScoreMonthlyResetScheduler {

    @Autowired
    private MediaScoreService mediaScoreService;

    @Scheduled(cron = "${media.score.reset.cron:0 0 0 1 * *}")
    public void resetMonthlyScores() {
        mediaScoreService.runMonthlyReset();
    }
}
