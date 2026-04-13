package org.example.backend.repository;

import org.example.backend.model.Transport;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface TransportRepository extends JpaRepository<Transport, Integer> {

    List<Transport> findByDepartureCity_CityIdAndArrivalCity_CityIdAndIsActiveTrue(int departureCityId, int arrivalCityId);

    List<Transport> findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
            int dpId, int arId, LocalDateTime start, LocalDateTime end);

    List<Transport> findByTypeAndIsActiveTrue(Transport.TransportType type);

    List<Transport> findByIsActiveTrue();

        @EntityGraph(attributePaths = {"departureCity", "arrivalCity"})
        List<Transport> findTop5ByIsActiveTrueOrderByDepartureTimeAsc();

    @Query("SELECT COUNT(t) > 0 FROM Transport t WHERE t.vehicle.vehicleId = :vehicleId " +
           "AND t.isActive = true AND t.departureTime < :arrivalTime AND t.arrivalTime > :departureTime")
    boolean existsByVehicleIdAndTimeOverlap(
            @Param("vehicleId") Integer vehicleId,
            @Param("departureTime") LocalDateTime departureTime,
            @Param("arrivalTime") LocalDateTime arrivalTime);

    @Query("SELECT COUNT(t) > 0 FROM Transport t WHERE t.vehicle.vehicleId = :vehicleId " +
           "AND t.isActive = true AND t.departureTime < :arrivalTime AND t.arrivalTime > :departureTime " +
           "AND t.transportId <> :excludeId")
    boolean existsByVehicleIdAndTimeOverlapExcluding(
            @Param("vehicleId") Integer vehicleId,
            @Param("departureTime") LocalDateTime departureTime,
            @Param("arrivalTime") LocalDateTime arrivalTime,
            @Param("excludeId") Integer excludeId);

    @Query("SELECT COUNT(t) > 0 FROM Transport t WHERE t.driver.driverId = :driverId " +
           "AND t.isActive = true AND t.departureTime < :arrivalTime AND t.arrivalTime > :departureTime")
    boolean existsByDriverIdAndTimeOverlap(
            @Param("driverId") Integer driverId,
            @Param("departureTime") LocalDateTime departureTime,
            @Param("arrivalTime") LocalDateTime arrivalTime);

    @Query("SELECT COUNT(t) > 0 FROM Transport t WHERE t.driver.driverId = :driverId " +
           "AND t.isActive = true AND t.departureTime < :arrivalTime AND t.arrivalTime > :departureTime " +
           "AND t.transportId <> :excludeId")
    boolean existsByDriverIdAndTimeOverlapExcluding(
            @Param("driverId") Integer driverId,
            @Param("departureTime") LocalDateTime departureTime,
            @Param("arrivalTime") LocalDateTime arrivalTime,
            @Param("excludeId") Integer excludeId);

    @Query("SELECT COUNT(t) FROM Transport t WHERE t.isActive = true")
    long countActive();

    @Query("SELECT COALESCE(SUM(t.capacity), 0) FROM Transport t WHERE t.isActive = true")
    long sumCapacityActive();

    /**
     * Transports expirés : {@code departureTime + 1h < now} ⇔ {@code departureTime < now - 1h}
     * (cutoff passé en paramètre).
     */
    @Query("SELECT t.transportId FROM Transport t WHERE t.departureTime IS NOT NULL AND t.departureTime < :cutoff")
    List<Integer> findExpiredTransportIds(@Param("cutoff") LocalDateTime cutoff);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Transport t SET t.isActive = false WHERE t.transportId IN :ids AND t.isActive = true")
    int deactivateByIdIn(@Param("ids") Collection<Integer> ids);
}
