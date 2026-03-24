package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="transport_reservations")
public class TransportReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer transportReservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="transport_id")
    private Transport transport;
    private Date travelDate;
    private Double totalPrice;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}