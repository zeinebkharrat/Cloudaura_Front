package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="reservations")
public class Reservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer reservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="room_id")
    private Room room;
    private Date checkInDate;
    private Date checkOutDate;
    private Double totalPrice;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}