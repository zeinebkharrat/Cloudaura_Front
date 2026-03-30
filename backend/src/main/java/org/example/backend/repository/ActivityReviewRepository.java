package org.example.backend.repository;

import org.example.backend.model.ActivityReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ActivityReviewRepository extends JpaRepository<ActivityReview, Integer> {

    Page<ActivityReview> findByActivityActivityId(Integer activityId, Pageable pageable);

    Optional<ActivityReview> findByActivityActivityIdAndUserUserId(Integer activityId, Integer userId);

    long countByActivityActivityId(Integer activityId);

    @Query("select avg(r.stars) from ActivityReview r where r.activity.activityId = :activityId")
    Double averageStarsByActivityId(@Param("activityId") Integer activityId);
}
