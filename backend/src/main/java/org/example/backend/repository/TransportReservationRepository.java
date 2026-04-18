package org.example.backend.repository;

import org.example.backend.model.TransportReservation;
import org.example.backend.model.TransportReservation.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransportReservationRepository extends JpaRepository<TransportReservation, Integer> {
    long countByTransport_TransportId(int transportId);

    List<TransportReservation> findByTransport_TransportId(int transportId);
    List<TransportReservation> findByUser_UserId(int userId);

    @Query("SELECT DISTINCT r FROM TransportReservation r " +
           "LEFT JOIN FETCH r.user u " +
           "LEFT JOIN FETCH r.transport t " +
           "LEFT JOIN FETCH t.departureCity " +
           "LEFT JOIN FETCH t.arrivalCity " +
           "WHERE u.userId = :userId " +
           "AND r.status IN (" +
           "org.example.backend.model.TransportReservation.ReservationStatus.PENDING, " +
           "org.example.backend.model.TransportReservation.ReservationStatus.CONFIRMED, " +
           "org.example.backend.model.TransportReservation.ReservationStatus.CANCELLED)")
    List<TransportReservation> findByUserIdWithAssociations(@Param("userId") int userId);

    Optional<TransportReservation> findByReservationRef(String ref);
    boolean existsByIdempotencyKey(String key);

    Optional<TransportReservation> findByIdempotencyKey(String idempotencyKey);

    @Query("SELECT COALESCE(SUM(r.numberOfSeats), 0) FROM TransportReservation r " +
           "WHERE r.transport.transportId = :id " +
           "AND r.status IN :statuses")
    int countBookedSeats(@Param("id") int transportId, @Param("statuses") List<ReservationStatus> statuses);

    default int countBookedSeats(int transportId) {
        return countBookedSeats(transportId, List.of(ReservationStatus.CONFIRMED, ReservationStatus.PENDING));
    }

    @Query("SELECT COUNT(r) FROM TransportReservation r " +
           "WHERE r.transport.transportId = :id " +
           "AND r.status IN :statuses " +
           "AND r.travelDate > CURRENT_TIMESTAMP")
    long countFutureActiveReservations(@Param("id") int transportId, @Param("statuses") List<ReservationStatus> statuses);

    default long countFutureActiveReservations(int transportId) {
        return countFutureActiveReservations(transportId, List.of(ReservationStatus.CONFIRMED, ReservationStatus.PENDING));
    }

    @Query("SELECT COUNT(r) FROM TransportReservation r " +
           "WHERE r.transport.transportId = :id " +
           "AND r.status = :status " +
           "AND r.travelDate > CURRENT_TIMESTAMP")
    long countFutureConfirmedReservations(@Param("id") int transportId, @Param("status") ReservationStatus status);

    default long countFutureConfirmedReservations(int transportId) {
        return countFutureConfirmedReservations(transportId, ReservationStatus.CONFIRMED);
    }

    @Query("SELECT COUNT(r) FROM TransportReservation r " +
           "WHERE r.status = :status " +
           "AND FUNCTION('DATE', r.travelDate) = FUNCTION('CURDATE')")
    long countTodayConfirmed(@Param("status") ReservationStatus status);

    default long countTodayConfirmed() {
        return countTodayConfirmed(ReservationStatus.CONFIRMED);
    }

    @Query("SELECT DISTINCT r FROM TransportReservation r " +
           "LEFT JOIN FETCH r.user " +
           "LEFT JOIN FETCH r.transport t " +
           "LEFT JOIN FETCH t.departureCity " +
           "LEFT JOIN FETCH t.arrivalCity " +
           "WHERE r.transportReservationId = :id")
    Optional<TransportReservation> findByIdWithAssociations(@Param("id") Integer id);

    /**
     * Réservations « actives futures » : PENDING ou CONFIRMED et voyage à partir d'aujourd'hui 00:00.
     */
    @Query("SELECT DISTINCT r.transport.transportId FROM TransportReservation r " +
           "WHERE r.transport.transportId IN :transportIds " +
           "AND r.status IN (org.example.backend.model.TransportReservation.ReservationStatus.PENDING, " +
           "org.example.backend.model.TransportReservation.ReservationStatus.CONFIRMED) " +
           "AND r.travelDate >= :startOfToday")
    List<Integer> findTransportIdsWithActiveFutureReservations(
            @Param("transportIds") Collection<Integer> transportIds,
            @Param("startOfToday") LocalDateTime startOfToday);

    @Query("SELECT DISTINCT r.transport.transportId FROM TransportReservation r " +
           "WHERE r.transport.transportId IN :transportIds")
    List<Integer> findTransportIdsHavingAnyReservation(@Param("transportIds") Collection<Integer> transportIds);

    @Query("SELECT r FROM TransportReservation r "
           + "WHERE r.reminderOneHourSent = false "
           + "AND r.status = org.example.backend.model.TransportReservation.ReservationStatus.CONFIRMED "
           + "AND r.travelDate >= :start "
           + "AND r.travelDate < :end ")
    List<TransportReservation> findDueForOneHourReminder(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT r.transportReservationId FROM TransportReservation r "
           + "LEFT JOIN r.transport t "
           + "WHERE (r.travelDate IS NOT NULL AND r.travelDate <= :cutoff) "
           + "OR (r.travelDate IS NULL AND t.departureTime IS NOT NULL AND t.departureTime <= :cutoff) "
           + "OR (r.travelDate IS NULL AND (t IS NULL OR t.departureTime IS NULL) "
           + "AND r.createdAt IS NOT NULL AND r.createdAt <= :cutoff)")
    List<Integer> findIdsEligibleForAutoDelete(@Param("cutoff") LocalDateTime cutoff);
}
