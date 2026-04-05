package org.example.backend.repository;

import org.example.backend.model.TransportReservation;
import org.example.backend.model.TransportReservation.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransportReservationRepository extends JpaRepository<TransportReservation, Integer> {
    List<TransportReservation> findByTransport_TransportId(int transportId);
    List<TransportReservation> findByUser_UserId(int userId);
    Optional<TransportReservation> findByReservationRef(String ref);
    boolean existsByIdempotencyKey(String key);

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
}