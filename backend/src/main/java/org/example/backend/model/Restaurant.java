package org.example.backend.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

/**
 * Table {@code restaurants}. PK colonne {@code restaurant_id} → propriété {@link #restaurantId}, getter
 * {@code getRestaurantId()}. Catalogue i18n (clés {@code restaurant.{id}.name|description}) : {@link #name},
 * {@link #description}. Valeurs locales non seedées en traductions : {@link #cuisineType}, {@link #address}.
 * Hors i18n catalogue : {@link #rating}, coordonnées, {@link #imageUrl}.
 */
@Data @Entity @Table(name="restaurants")
public class Restaurant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "restaurant_id")
    private Integer restaurantId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(name = "cuisine_type")
    private CuisineType cuisineType;
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
