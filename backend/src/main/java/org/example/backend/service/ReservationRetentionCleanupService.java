package org.example.backend.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationRetentionCleanupService {

    private final TransportReservationRepository transportReservationRepository;
    private final ReservationRepository reservationRepository;
    private final Clock clock;

    @Transactional
    public CleanupResult cleanupExpiredReservations(int retentionHours) {
        int hours = Math.max(1, retentionHours);
        LocalDateTime cutoff = LocalDateTime.now(clock).minusHours(hours);

        int transportDeleted = deleteTransportReservations(cutoff);
        int accommodationDeleted = deleteAccommodationReservations(cutoff);

        return new CleanupResult(cutoff, transportDeleted, accommodationDeleted);
    }

    private int deleteTransportReservations(LocalDateTime cutoff) {
        List<Integer> ids = transportReservationRepository.findIdsEligibleForAutoDelete(cutoff);
        if (ids.isEmpty()) {
            return 0;
        }
        transportReservationRepository.deleteAllByIdInBatch(ids);
        return ids.size();
    }

    private int deleteAccommodationReservations(LocalDateTime cutoff) {
        List<Integer> ids = reservationRepository.findIdsEligibleForAutoDelete(cutoff);
        if (ids.isEmpty()) {
            return 0;
        }
        reservationRepository.deleteAllByIdInBatch(ids);
        return ids.size();
    }

    public record CleanupResult(LocalDateTime cutoff, int transportDeleted, int accommodationDeleted) {
        public int totalDeleted() {
            return transportDeleted + accommodationDeleted;
        }
    }
}
