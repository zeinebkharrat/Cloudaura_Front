package org.example.backend.repository;

import org.example.backend.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Integer> {
    // Find events by city for better filtering in the UI
    List<Event> findByCityCityId(Integer cityId);

    // Find by type (e.g., "Festival", "Hiking")
    List<Event> findByEventType(String eventType);
}