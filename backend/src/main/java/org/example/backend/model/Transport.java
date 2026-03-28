package org.example.backend.model;

import org.example.backend.model.City;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "transports")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Transport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transport_id")
    private Integer transportId;

    @Enumerated(EnumType.STRING)
    private TransportType type;

    @Column(name = "departure_time")
    private LocalDateTime departureTime;

    @Column(name = "arrival_time")
    private LocalDateTime arrivalTime;

    private Integer capacity;
    private Double price;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "departure_city_id")
    private City departureCity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "arrival_city_id")
    private City arrivalCity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @Transient
    private int availableSeats;

    public enum TransportType { BUS, TAXI, VAN, CAR, PLANE }
}
