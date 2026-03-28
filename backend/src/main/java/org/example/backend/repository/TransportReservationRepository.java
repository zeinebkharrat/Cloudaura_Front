package org.example.backend.repository;

import org.example.backend.model.TransportReservation;
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
           "AND r.status IN (com.yallatn.model.transport.TransportReservation.ReservationStatus.CONFIRMED, " +
           "com.yallatn.model.transport.TransportReservation.ReservationStatus.PENDING)")
    int countBookedSeats(@Param("id") int transportId);
}
