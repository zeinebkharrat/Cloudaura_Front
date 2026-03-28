package com.yallatn.repository.transport;

import com.yallatn.model.transport.Transport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TransportRepository extends JpaRepository<Transport, Integer> {
    List<Transport> findByDepartureCity_CityIdAndArrivalCity_CityIdAndIsActiveTrue(int departureCityId, int arrivalCityId);

    List<Transport> findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
            int dpId, int arId, LocalDateTime start, LocalDateTime end);

    List<Transport> findByTypeAndIsActiveTrue(Transport.TransportType type);

    List<Transport> findByIsActiveTrue();
}
