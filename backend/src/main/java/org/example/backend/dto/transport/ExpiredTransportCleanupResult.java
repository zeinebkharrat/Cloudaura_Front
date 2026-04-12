package org.example.backend.dto.transport;

/**
 * Résumé d'un passage du nettoyage des transports expirés (scheduler).
 */
public record ExpiredTransportCleanupResult(
        int expiredTransportsScanned,
        int skippedDueToActiveFutureReservations,
        int softDeactivated,
        int hardDeleted,
        int hardDeleteFailures
) {
    public static ExpiredTransportCleanupResult empty() {
        return new ExpiredTransportCleanupResult(0, 0, 0, 0, 0);
    }
}
