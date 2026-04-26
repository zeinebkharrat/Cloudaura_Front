package org.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "transport_quote_request",
    indexes = {
        @Index(name = "idx_quote_route_date", columnList = "departure_city_id,arrival_city_id,travel_date"),
        @Index(name = "idx_quote_user_date", columnList = "user_id,created_at")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportQuoteRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "quote_id")
    private Long quoteId;

    @Column(name = "user_id")
    private Integer userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "transport_type", nullable = false, length = 20)
    private Transport.TransportType transportType;

    @Column(name = "departure_city_id", nullable = false)
    private Integer departureCityId;

    @Column(name = "arrival_city_id", nullable = false)
    private Integer arrivalCityId;

    @Column(name = "travel_date", nullable = false)
    private LocalDate travelDate;

    @Column(name = "seats", nullable = false)
    private Integer seats;

    @Column(name = "route_km", precision = 10, scale = 2)
    private BigDecimal routeKm;

    @Column(name = "route_duration_min")
    private Integer routeDurationMin;

    @Column(name = "estimated_price_base", nullable = false, precision = 10, scale = 2)
    private BigDecimal estimatedPriceBase;

    @Column(name = "estimated_price_min", nullable = false, precision = 10, scale = 2)
    private BigDecimal estimatedPriceMin;

    @Column(name = "estimated_price_max", nullable = false, precision = 10, scale = 2)
    private BigDecimal estimatedPriceMax;

    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private String currency = "TND";

    @Column(name = "advisory_applied", nullable = false)
    @Builder.Default
    private Boolean advisoryApplied = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "advisory_id")
    private TransportAdvisoryCalendar advisory;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
