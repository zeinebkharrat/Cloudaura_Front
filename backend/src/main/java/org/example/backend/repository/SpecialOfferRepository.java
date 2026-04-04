package org.example.backend.repository;

import org.example.backend.model.SpecialOffer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SpecialOfferRepository extends JpaRepository<SpecialOffer, Integer> {
    @Query("SELECT s FROM SpecialOffer s WHERE s.city.cityId = :cityId " +
           "AND s.startDate <= :now AND s.endDate >= :now")
    List<SpecialOffer> findActiveOffersByCity(@Param("cityId") int cityId, @Param("now") LocalDateTime now);
}
