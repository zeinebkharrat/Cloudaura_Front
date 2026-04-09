package org.example.backend.repository;

import org.example.backend.model.DailyChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface DailyChallengeRepository extends JpaRepository<DailyChallenge, Integer> {

    @Query(
            "select c from DailyChallenge c where c.active = true "
                    + "and c.validFrom <= :now and c.validTo >= :now")
    List<DailyChallenge> findActiveAt(@Param("now") Date now);
}
