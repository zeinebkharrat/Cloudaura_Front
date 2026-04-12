package org.example.backend.repository;

import org.example.backend.model.PassportCityStamp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PassportCityStampRepository extends JpaRepository<PassportCityStamp, Integer> {

    @Query("SELECT s FROM PassportCityStamp s "
            + "JOIN FETCH s.city c "
            + "WHERE s.passport.passportId = :passportId "
            + "ORDER BY s.lastVisitedAt DESC")
    List<PassportCityStamp> findByPassportIdWithCity(@Param("passportId") Integer passportId);

    Optional<PassportCityStamp> findByPassportPassportIdAndCityCityId(Integer passportId, Integer cityId);
}
