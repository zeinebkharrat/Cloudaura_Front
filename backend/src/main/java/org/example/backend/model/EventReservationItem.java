package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="event_reservation_items")
public class EventReservationItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer reservationItemId;
    @ManyToOne @JoinColumn(name="event_reservation_id")
    private EventReservation eventReservation;
    @ManyToOne @JoinColumn(name="ticket_type_id")
    private TicketType ticketType;
    private Integer quantity;
}