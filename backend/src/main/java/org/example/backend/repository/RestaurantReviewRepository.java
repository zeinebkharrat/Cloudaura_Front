package org.example.backend.repository;

import org.example.backend.model.RestaurantReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RestaurantReviewRepository extends JpaRepository<RestaurantReview, Integer> {

    Page<RestaurantReview> findByRestaurantRestaurantId(Integer restaurantId, Pageable pageable);

    Optional<RestaurantReview> findByRestaurantRestaurantIdAndUserUserId(Integer restaurantId, Integer userId);

    long countByRestaurantRestaurantId(Integer restaurantId);

    @Query("select avg(r.stars) from RestaurantReview r where r.restaurant.restaurantId = :restaurantId")
    Double averageStarsByRestaurantId(@Param("restaurantId") Integer restaurantId);
}
