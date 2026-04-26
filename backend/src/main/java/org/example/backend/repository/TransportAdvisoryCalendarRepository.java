package org.example.backend.repository;

import org.example.backend.model.Transport;
import org.example.backend.model.TransportAdvisoryCalendar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TransportAdvisoryCalendarRepository extends JpaRepository<TransportAdvisoryCalendar, Integer> {

    @Query("SELECT a FROM TransportAdvisoryCalendar a " +
           "WHERE a.isActive = true " +
           "AND a.transportType = :type " +
           "AND :travelDate BETWEEN a.startDate AND a.endDate " +
           "ORDER BY a.priceMultiplierMax DESC")
    List<TransportAdvisoryCalendar> findActiveByTypeAndTravelDate(
            @Param("type") Transport.TransportType type,
            @Param("travelDate") LocalDate travelDate);
}
