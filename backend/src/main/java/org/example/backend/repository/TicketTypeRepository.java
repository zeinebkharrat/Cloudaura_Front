package org.example.backend.repository;

import org.example.backend.model.TicketType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TicketTypeRepository extends JpaRepository<TicketType, Integer> {

    Optional<TicketType> findFirstByEvent_EventIdOrderByTicketTypeIdAsc(Integer eventId);
}
