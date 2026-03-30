package org.example.backend.repository;

import org.example.backend.model.Reservation;
import org.example.backend.model.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Integer> {
    List<Reservation> findByUser_UserId(int userId);
    List<Reservation> findByRoom_RoomIdAndStatus(int roomId, ReservationStatus status);
    List<Reservation> findByStatusAndCheckOutDateBefore(ReservationStatus status, LocalDateTime now);
    void deleteByRoom_RoomId(int roomId);
}
