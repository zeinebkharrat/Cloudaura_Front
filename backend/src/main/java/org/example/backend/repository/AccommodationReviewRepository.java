package org.example.backend.repository;

import org.example.backend.model.AccommodationReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AccommodationReviewRepository extends JpaRepository<AccommodationReview, Integer> {

    Page<AccommodationReview> findByAccommodationAccommodationId(Integer accommodationId, Pageable pageable);

    Optional<AccommodationReview> findByAccommodationAccommodationIdAndUserUserId(Integer accommodationId, Integer userId);

    long countByAccommodationAccommodationId(Integer accommodationId);

    void deleteByAccommodationCityCityId(Integer cityId);

    @Query("select avg(r.stars) from AccommodationReview r where r.accommodation.accommodationId = :accommodationId")
    Double averageStarsByAccommodationId(@Param("accommodationId") Integer accommodationId);
}
