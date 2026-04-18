package org.example.backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.service.ReservationRetentionCleanupService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "reservation.cleanup.enabled", havingValue = "true", matchIfMissing = true)
public class ReservationRetentionCleanupScheduler {

    private final ReservationRetentionCleanupService cleanupService;

    @Value("${reservation.cleanup.retention-hours:24}")
    private int retentionHours;

    /**
     * Defaults to every hour at minute 17 to avoid colliding with other periodic jobs.
     */
    @Scheduled(cron = "${reservation.cleanup.cron:0 17 * * * *}")
    public void runCleanup() {
        try {
            var result = cleanupService.cleanupExpiredReservations(retentionHours);
            if (result.totalDeleted() > 0) {
                log.info(
                        "Reservation cleanup executed (cutoff={}, retention={}h): deleted transport={}, accommodation={}, total={}",
                        result.cutoff(),
                        Math.max(1, retentionHours),
                        result.transportDeleted(),
                        result.accommodationDeleted(),
                        result.totalDeleted());
            }
        } catch (Exception ex) {
            log.error("Reservation cleanup job failed", ex);
        }
    }
}
