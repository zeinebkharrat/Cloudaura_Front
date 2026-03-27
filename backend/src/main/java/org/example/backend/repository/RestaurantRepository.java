package org.example.backend.repository;

import org.example.backend.model.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface RestaurantRepository extends JpaRepository<Restaurant, Integer>, JpaSpecificationExecutor<Restaurant> {
    void deleteByCityCityId(Integer cityId);
    List<Restaurant> findByCityCityIdOrderByRestaurantIdDesc(Integer cityId);
}