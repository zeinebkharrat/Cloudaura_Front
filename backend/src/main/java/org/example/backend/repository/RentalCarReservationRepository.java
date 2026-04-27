package org.example.backend.repository;

import org.example.backend.model.RentalCarReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;

@Repository
public interface RentalCarReservationRepository extends JpaRepository<RentalCarReservation, Integer> {

    /**
     * True if an active reservation overlaps [pickup, return) for this fleet car.
     */
    @Query("""
            SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END
            FROM RentalCarReservation r
            WHERE r.fleetCar.fleetCarId = :fleetCarId
              AND r.status IN :activeStatuses
              AND r.pickupDatetime < :returnDt
              AND r.returnDatetime > :pickupDt
            """)
    boolean existsOverlappingActive(
            @Param("fleetCarId") Integer fleetCarId,
            @Param("pickupDt") LocalDateTime pickupDt,
            @Param("returnDt") LocalDateTime returnDt,
            @Param("activeStatuses") Collection<RentalCarReservation.RentalStatus> activeStatuses);

    long countByFleetCar_FleetCarId(Integer fleetCarId);
}
