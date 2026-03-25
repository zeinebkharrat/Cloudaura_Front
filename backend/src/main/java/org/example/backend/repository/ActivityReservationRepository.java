package org.example.backend.repository;

import org.example.backend.model.ActivityReservation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityReservationRepository extends JpaRepository<ActivityReservation, Integer> {
}