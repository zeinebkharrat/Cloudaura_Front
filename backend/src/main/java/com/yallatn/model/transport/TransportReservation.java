package com.yallatn.model.transport;

import com.yallatn.model.shared.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "transport_reservations")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transport_reservation_id")
    private Integer transportReservationId;

    @Enumerated(EnumType.STRING)
    private ReservationStatus status;

    @Column(name = "total_price")
    private Double totalPrice;

    @Column(name = "travel_date")
    private LocalDateTime travelDate;

    @Column(name = "number_of_seats")
    private Integer numberOfSeats;

    @Column(name = "passenger_first_name", length = 100)
    private String passengerFirstName;

    @Column(name = "passenger_last_name", length = 100)
    private String passengerLastName;

    @Column(name = "passenger_email")
    private String passengerEmail;

    @Column(name = "passenger_phone", length = 20)
    private String passengerPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    private PaymentStatus paymentStatus;

    @Column(name = "reservation_ref", unique = true, length = 20)
    private String reservationRef;

    @Column(name = "idempotency_key", unique = true, length = 36)
    private String idempotencyKey;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transport_id")
    private Transport transport;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    public enum ReservationStatus { PENDING, CONFIRMED, CANCELLED }
    public enum PaymentMethod { CASH, KONNECT }
    public enum PaymentStatus { PENDING, PAID, REFUNDED }
}
