package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="activity_reservations")
public class ActivityReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer activityReservationId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="activity_id")
    private Activity activity;
    private Date reservationDate;
    private Integer numberOfPeople;
    private Double totalPrice;
    @Enumerated(EnumType.STRING)
    private ReservationStatus status;
}