package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="event_reservations")
public class EventReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer eventReservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="event_id")
    private Event event;
    private Double totalAmount;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}