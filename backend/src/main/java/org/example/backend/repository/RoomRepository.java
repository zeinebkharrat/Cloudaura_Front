package org.example.backend.repository;

import org.example.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Integer> {
    List<Room> findByAccommodation_AccommodationId(int accommodationId);
    List<Room> findByAccommodation_AccommodationIdAndRoomType(int accId, Room.RoomType roomType);

       void deleteByAccommodationCityCityId(Integer cityId);

    @Query("SELECT r FROM Room r WHERE r.accommodation.accommodationId = :accId " +
           "AND r.roomId NOT IN (" +
           "  SELECT res.room.roomId FROM Reservation res " +
           "  WHERE res.room.roomId IS NOT NULL " +
           "  AND res.status IN (org.example.backend.model.ReservationStatus.CONFIRMED, org.example.backend.model.ReservationStatus.PENDING) " +
           "  AND res.checkOutDate > :checkIn " +
           "  AND res.checkInDate < :checkOut" +
           ")")
    List<Room> findAvailableRooms(
            @Param("accId") int accommodationId,
            @Param("checkIn") LocalDateTime checkIn,
            @Param("checkOut") LocalDateTime checkOut);
}
