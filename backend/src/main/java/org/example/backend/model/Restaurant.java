package org.example.backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

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
    private String phoneNumber;
    private Double latitude;
    private Double longitude;
    private String imageUrl;

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("displayOrder ASC, menuImageId ASC")
    @JsonIgnoreProperties("restaurant")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<RestaurantMenuImage> menuImages = new ArrayList<>();
}
