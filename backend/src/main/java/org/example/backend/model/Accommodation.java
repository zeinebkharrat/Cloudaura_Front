package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="accommodations")
public class Accommodation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer accommodationId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    private String type;
    private Double pricePerNight;
    private Double rating;
    private String status;
}