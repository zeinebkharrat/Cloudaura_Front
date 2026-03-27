package org.example.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cities")
public class City {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cityId;

    private String name;
    private String region;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String description;

    private Double latitude;
    private Double longitude;

    public Integer getCityId() { return cityId; }
    public void setCityId(Integer cityId) { this.cityId = cityId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}