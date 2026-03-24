package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="cities")
public class City {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cityId;
    private String name;
    private String region;
    @Lob @Column(columnDefinition="TEXT")
    private String description;
    private Double latitude;
    private Double longitude;
}