package org.example.backend.repository;

import org.example.backend.model.EventReservationItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventReservationItemRepository extends JpaRepository<EventReservationItem, Integer> {

	void deleteByEventReservation_Event_EventId(Integer eventId);
	Optional<EventReservationItem> findByQrCodeToken(String qrCodeToken);

	@EntityGraph(attributePaths = {"eventReservation", "eventReservation.user", "eventReservation.event", "ticketType"})
	List<EventReservationItem> findTop200ByOrderByReservationItemIdDesc();

	@EntityGraph(attributePaths = {"eventReservation", "eventReservation.user", "eventReservation.event", "ticketType"})
	List<EventReservationItem> findByEventReservation_EventReservationIdOrderByReservationItemIdAsc(Integer eventReservationId);

	@EntityGraph(attributePaths = {"eventReservation", "eventReservation.user", "eventReservation.event", "ticketType"})
	Optional<EventReservationItem> findDetailedByQrCodeToken(String qrCodeToken);

	@EntityGraph(attributePaths = {"eventReservation", "eventReservation.user", "eventReservation.event", "ticketType"})
	List<EventReservationItem> findTop1000ByOrderByReservationItemIdDesc();

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("""
			update EventReservationItem i
			set i.isScanned = true,
			    i.scannedAt = CURRENT_TIMESTAMP
			where i.reservationItemId = :itemId
			  and (i.isScanned = false or i.isScanned is null)
			""")
	int markAsScannedIfNotYet(@Param("itemId") Integer itemId);
}
