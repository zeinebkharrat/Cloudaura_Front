package org.example.backend.repository;

import org.example.backend.model.Distance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DistanceRepository extends JpaRepository<Distance, Long> {
    Optional<Distance> findByFromCity_CityIdAndToCity_CityId(Integer fromCityId, Integer toCityId);
    boolean existsByFromCity_CityIdAndToCity_CityId(Integer fromCityId, Integer toCityId);
}
