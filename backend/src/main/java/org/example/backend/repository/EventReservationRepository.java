package org.example.backend.repository;

import org.example.backend.model.EventReservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventReservationRepository extends JpaRepository<EventReservation, Integer> {
	List<EventReservation> findByUserUserIdOrderByEventReservationIdDesc(Integer userId);
}
