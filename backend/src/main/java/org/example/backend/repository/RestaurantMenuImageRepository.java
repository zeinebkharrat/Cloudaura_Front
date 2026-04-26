package org.example.backend.repository;

import org.example.backend.model.RestaurantMenuImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RestaurantMenuImageRepository extends JpaRepository<RestaurantMenuImage, Integer> {

    @Query("select coalesce(max(img.displayOrder), 0) from RestaurantMenuImage img where img.restaurant.restaurantId = :restaurantId")
    int findMaxDisplayOrderByRestaurantId(@Param("restaurantId") Integer restaurantId);

    void deleteByRestaurantCityCityId(Integer cityId);
}