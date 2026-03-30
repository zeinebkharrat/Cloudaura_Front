package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="restaurants")
public class Restaurant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer restaurantId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    private String cuisineType;
    private Double rating;
    @Lob @Column(columnDefinition="TEXT")
    private String description;
    private String address;
    private Double latitude;
    private Double longitude;
    private String imageUrl;
}
