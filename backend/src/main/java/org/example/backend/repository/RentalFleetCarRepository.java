package org.example.backend.repository;

import org.example.backend.model.RentalFleetCar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RentalFleetCarRepository extends JpaRepository<RentalFleetCar, Integer> {

    List<RentalFleetCar> findByCity_CityIdAndIsActiveTrueOrderByDailyRateTndAsc(Integer cityId);

    @Query(
            """
                    SELECT DISTINCT c FROM RentalFleetCar c
                    JOIN FETCH c.city
                    ORDER BY c.city.name ASC, c.category ASC, c.fleetCarId ASC
                    """)
    List<RentalFleetCar> findAllWithCityOrdered();

    long countByIsActiveTrue();

    @Query("SELECT COUNT(DISTINCT c.city.cityId) FROM RentalFleetCar c")
    long countDistinctCities();
}
