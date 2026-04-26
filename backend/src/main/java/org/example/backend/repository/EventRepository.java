package org.example.backend.repository;

import org.example.backend.model.Event;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Integer> {
    // Find events by city for better filtering in the UI
    List<Event> findByCityCityId(Integer cityId);

    void deleteByCityCityId(Integer cityId);

    // Find by type (e.g., "Festival", "Hiking")
    List<Event> findByEventType(String eventType);

        @Modifying
        @Query("""
                        update Event e
                        set e.status = 'COMPLETED'
                        where e.endDate is not null
                            and e.endDate < CURRENT_TIMESTAMP
                            and upper(coalesce(e.status, '')) <> 'COMPLETED'
                        """)
        int markCompletedByDate();

        @Modifying
        @Query("""
                        update Event e
                        set e.status = 'ONGOING'
                        where e.startDate is not null
                            and e.startDate <= CURRENT_TIMESTAMP
                            and (e.endDate is null or e.endDate >= CURRENT_TIMESTAMP)
                            and upper(coalesce(e.status, '')) <> 'ONGOING'
                        """)
        int markOngoingByDate();

        @Modifying
        @Query("""
                        update Event e
                        set e.status = 'UPCOMING'
                        where e.startDate is not null
                            and e.startDate > CURRENT_TIMESTAMP
                            and upper(coalesce(e.status, '')) <> 'UPCOMING'
                        """)
        int markUpcomingByDate();

                @Modifying
                @Query(value = """
                    UPDATE events
                    SET reserved_count = COALESCE(reserved_count, 0) + :quantity
                    WHERE event_id = :eventId
                      AND COALESCE(reserved_count, 0) + :quantity <= COALESCE(total_capacity, 0)
                    """, nativeQuery = true)
                int reserveSpotsIfAvailable(@Param("eventId") Integer eventId, @Param("quantity") int quantity);
}