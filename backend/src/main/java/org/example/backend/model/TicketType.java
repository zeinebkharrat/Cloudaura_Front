package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="ticket_types")
public class TicketType {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer ticketTypeId;
    @ManyToOne @JoinColumn(name="event_id")
    private Event event;
    private String name;
    private Double price;
    private Integer totalQuantity;
}