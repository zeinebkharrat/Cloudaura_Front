package com.yallatn.repository.accommodation;

import com.yallatn.model.accommodation.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Integer> {
    List<Reservation> findByUser_UserId(int userId);
    List<Reservation> findByRoom_RoomIdAndStatus(int roomId, Reservation.ReservationStatus status);
    List<Reservation> findByStatusAndCheckOutDateBefore(Reservation.ReservationStatus status, LocalDateTime now);
}
