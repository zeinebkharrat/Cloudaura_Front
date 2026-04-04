package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "drivers")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Driver {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "driver_id")
    private Integer driverId;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "license_number")
    private String licenseNumber;

    private String phone;
    private String email;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Builder.Default
    private Double rating = 0.0;

    @Column(name = "total_trips")
    @Builder.Default
    private Integer totalTrips = 0;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
}
