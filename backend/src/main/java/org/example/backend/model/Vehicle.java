package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "vehicles")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Vehicle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vehicle_id")
    private Integer vehicleId;

    @Column(nullable = false, length = 100)
    private String brand;

    @Column(nullable = false, length = 100)
    private String model;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VehicleType type;

    @Column(name = "vehicle_type")
    private String vehicleTypeLabel;

    private Integer capacity;

    @Column(name = "plate_number", nullable = false, length = 20)
    private String plateNumber;

    @Column(name = "registration_number")
    private String registrationNumber;

    @Column(length = 50)
    private String color;

    private Integer year;

    @Column(name = "price_per_trip", nullable = false)
    private Double pricePerTrip;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public enum VehicleType { BUS, CAR, PLANE, TAXI, VAN }
}
