package com.yallatn.model.shared;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "cities")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class City {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "city_id")
    private Integer cityId;

    private String name;
    private String region;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String description;

    private Double latitude;
    private Double longitude;

    @Column(name = "has_airport")
    private Boolean hasAirport;

    @Column(name = "has_bus_station")
    private Boolean hasBusStation;

    @Column(name = "has_ferry_port")
    private Boolean hasFerryPort;

    @Column(name = "has_louage_station")
    private Boolean hasLouageStation;
}
