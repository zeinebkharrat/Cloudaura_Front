package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "rental_car_reservations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RentalCarReservation {

    public enum RentalStatus {
        PENDING,
        CONFIRMED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rental_reservation_id")
    private Integer rentalReservationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fleet_car_id", nullable = false)
    private RentalFleetCar fleetCar;

    /** Set when the client was authenticated (JWT); optional for anonymous simulation. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "pickup_datetime", nullable = false)
    private LocalDateTime pickupDatetime;

    @Column(name = "return_datetime", nullable = false)
    private LocalDateTime returnDatetime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    @Builder.Default
    private RentalStatus status = RentalStatus.CONFIRMED;

    @Column(name = "total_price_tnd", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPriceTnd;

    @Column(name = "confirmation_ref", length = 40, unique = true)
    private String confirmationRef;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
