package org.example.backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.service.ExpiredTransportCleanupService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Planification du nettoyage des transports expirés (départ + 1h &lt; maintenant).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "transport.cleanup.enabled", havingValue = "true", matchIfMissing = true)
public class ExpiredTransportCleanupScheduler {

    private final ExpiredTransportCleanupService expiredTransportCleanupService;

    /**
     * Cron par défaut : toutes les heures à la 12e minute (évite pic pile sur l'heure).
     * Surcharge : {@code transport.cleanup.cron}
     */
    @Scheduled(cron = "${transport.cleanup.cron:0 12 * * * *}")
    public void runExpiredTransportCleanup() {
        try {
            var result = expiredTransportCleanupService.cleanupExpiredTransports();
            if (result.expiredTransportsScanned() > 0) {
                log.info(
                        "Nettoyage transports expirés — scannés={}, ignorés (résa. actives futures)={}, désactivés={}, supprimés={}, échecs suppression={}",
                        result.expiredTransportsScanned(),
                        result.skippedDueToActiveFutureReservations(),
                        result.softDeactivated(),
                        result.hardDeleted(),
                        result.hardDeleteFailures()
                );
            }
        } catch (Exception ex) {
            log.error("Échec du job nettoyage transports expirés", ex);
        }
    }
}
