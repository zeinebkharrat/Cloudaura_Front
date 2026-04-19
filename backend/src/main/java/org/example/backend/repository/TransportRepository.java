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

        @EntityGraph(attributePaths = {"departureCity", "arrivalCity"})
        List<Transport> findByDepartureCity_CityIdAndArrivalCity_CityIdAndIsActiveTrue(int departureCityId, int arrivalCityId);

    List<Transport> findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
            int dpId, int arId, LocalDateTime start, LocalDateTime end);

    List<Transport> findByTypeAndIsActiveTrue(Transport.TransportType type);

        @EntityGraph(attributePaths = {"departureCity", "arrivalCity"})
        List<Transport> findByIsActiveTrue();

        @EntityGraph(attributePaths = {"departureCity", "arrivalCity"})
        List<Transport> findTop5ByIsActiveTrueOrderByDepartureTimeAsc();

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
