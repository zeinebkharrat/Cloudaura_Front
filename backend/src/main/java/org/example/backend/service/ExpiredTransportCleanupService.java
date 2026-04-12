package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.transport.ExpiredTransportCleanupResult;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/**
 * Nettoyage métier des transports expirés ({@code départ + 1h} dans le passé).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExpiredTransportCleanupService {

    private static final int IN_CLAUSE_BATCH_SIZE = 500;

    private final TransportRepository transportRepository;
    private final TransportReservationRepository reservationRepository;
    private final Clock clock;

    /**
     * <ul>
     *   <li>Réservations actives futures (PENDING/CONFIRMED, voyage &gt;= aujourd'hui) → ne rien faire.</li>
     *   <li>Sinon, s'il existe des réservations → désactivation ({@code isActive = false}).</li>
     *   <li>Sinon → suppression définitive.</li>
     * </ul>
     */
    @Transactional
    public ExpiredTransportCleanupResult cleanupExpiredTransports() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime cutoff = now.minusHours(1);
        LocalDateTime startOfToday = LocalDate.now(clock).atStartOfDay();

        List<Integer> expiredIds = transportRepository.findExpiredTransportIds(cutoff);
        if (expiredIds.isEmpty()) {
            return ExpiredTransportCleanupResult.empty();
        }

        Set<Integer> withActiveFuture = collectInBatches(
                expiredIds,
                chunk -> new HashSet<>(reservationRepository.findTransportIdsWithActiveFutureReservations(chunk, startOfToday))
        );

        List<Integer> eligible = expiredIds.stream()
                .filter(id -> !withActiveFuture.contains(id))
                .toList();

        if (eligible.isEmpty()) {
            return new ExpiredTransportCleanupResult(
                    expiredIds.size(),
                    withActiveFuture.size(),
                    0,
                    0,
                    0
            );
        }

        Set<Integer> withAnyReservation = collectInBatches(
                eligible,
                chunk -> new HashSet<>(reservationRepository.findTransportIdsHavingAnyReservation(chunk))
        );

        List<Integer> toSoft = eligible.stream().filter(withAnyReservation::contains).toList();
        List<Integer> toHard = eligible.stream().filter(id -> !withAnyReservation.contains(id)).toList();

        int softTotal = batchDeactivate(toSoft);
        int hardOk = 0;
        int hardFail = 0;
        for (Integer id : toHard) {
            try {
                transportRepository.deleteById(id);
                transportRepository.flush();
                hardOk++;
            } catch (DataIntegrityViolationException ex) {
                hardFail++;
                log.warn("Suppression transport {} impossible (intégrité référentielle) : {}", id, ex.getMostSpecificCause().getMessage());
            }
        }

        return new ExpiredTransportCleanupResult(
                expiredIds.size(),
                withActiveFuture.size(),
                softTotal,
                hardOk,
                hardFail
        );
    }

    private int batchDeactivate(List<Integer> ids) {
        int total = 0;
        for (List<Integer> chunk : partition(ids, IN_CLAUSE_BATCH_SIZE)) {
            if (!chunk.isEmpty()) {
                total += transportRepository.deactivateByIdIn(chunk);
            }
        }
        return total;
    }

    private <T> Set<T> collectInBatches(List<Integer> ids, Function<List<Integer>, Set<T>> queryChunk) {
        Set<T> acc = new HashSet<>();
        for (List<Integer> chunk : partition(ids, IN_CLAUSE_BATCH_SIZE)) {
            if (!chunk.isEmpty()) {
                acc.addAll(queryChunk.apply(chunk));
            }
        }
        return acc;
    }

    private static List<List<Integer>> partition(List<Integer> ids, int size) {
        List<List<Integer>> out = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += size) {
            out.add(ids.subList(i, Math.min(i + size, ids.size())));
        }
        return out;
    }
}
