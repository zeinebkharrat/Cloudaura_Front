package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "distances", uniqueConstraints =
    @UniqueConstraint(columnNames = {"from_city_id", "to_city_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Distance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "distance_id")
    private Long distanceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_city_id", nullable = false)
    private City fromCity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_city_id", nullable = false)
    private City toCity;

    /** Road distance in kilometres (Haversine × 1.25 road factor). */
    @Column(name = "distance_km", nullable = false)
    private Double distanceKm;
}
