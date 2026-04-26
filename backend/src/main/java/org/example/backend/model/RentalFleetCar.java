package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Internal Tunisia car-rental catalogue (no Amadeus): one row per bookable vehicle at a city station.
 */
@Entity
@Table(name = "rental_fleet_cars")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RentalFleetCar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "fleet_car_id")
    private Integer fleetCarId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "city_id", nullable = false)
    private City city;

    /** e.g. ECONOMY, COMPACT, SUV */
    @Column(name = "category", length = 32, nullable = false)
    private String category;

    @Column(name = "model_label", length = 160, nullable = false)
    private String modelLabel;

    /** Price per calendar rental day (TND). */
    @Column(name = "daily_rate_tnd", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyRateTnd;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
