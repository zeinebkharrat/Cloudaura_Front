package org.example.backend.repository;

import org.example.backend.model.Reservation;
import org.example.backend.model.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Integer> {
    List<Reservation> findByUser_UserId(int userId);
        long countByUser_UserId(Integer userId);
    List<Reservation> findByRoom_RoomIdAndStatus(int roomId, ReservationStatus status);
    List<Reservation> findByStatusAndCheckOutDateBefore(ReservationStatus status, LocalDateTime now);
    void deleteByRoom_RoomId(int roomId);

    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.room.roomId = :roomId "
            + "AND r.reservationId <> :excludeId "
            + "AND r.status IN (org.example.backend.model.ReservationStatus.PENDING, org.example.backend.model.ReservationStatus.CONFIRMED) "
            + "AND r.checkOutDate > :checkIn AND r.checkInDate < :checkOut")
    long countOverlappingExcept(
            @Param("roomId") int roomId,
            @Param("excludeId") int excludeId,
            @Param("checkIn") LocalDateTime checkIn,
            @Param("checkOut") LocalDateTime checkOut);

    @Query(
            "SELECT DISTINCT r FROM Reservation r "
                    + "LEFT JOIN FETCH r.room rm "
                    + "LEFT JOIN FETCH rm.accommodation acc "
                    + "LEFT JOIN FETCH acc.city "
                    + "LEFT JOIN FETCH r.user "
                    + "WHERE r.reservationId = :id")
    Optional<Reservation> findByIdWithAssociations(@Param("id") Integer id);

    /** Abandoned Stripe checkouts: same user/room + overlapping stay — remove so a new checkout can start. */
    @Modifying(clearAutomatically = true)
    @Query(
            "DELETE FROM Reservation r WHERE r.status = org.example.backend.model.ReservationStatus.PENDING "
                    + "AND r.user.userId = :userId AND r.room.roomId = :roomId "
                    + "AND r.checkOutDate > :checkIn AND r.checkInDate < :checkOut")
    int deletePendingOverlappingForUserRoom(
            @Param("userId") int userId,
            @Param("roomId") int roomId,
            @Param("checkIn") LocalDateTime checkIn,
            @Param("checkOut") LocalDateTime checkOut);

    @Query("SELECT r.reservationId FROM Reservation r "
            + "WHERE (r.checkOutDate IS NOT NULL AND r.checkOutDate <= :cutoff) "
            + "OR (r.checkOutDate IS NULL AND r.checkInDate IS NOT NULL AND r.checkInDate <= :cutoff)")
    List<Integer> findIdsEligibleForAutoDelete(@Param("cutoff") LocalDateTime cutoff);
}
