package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;

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
    private String cuisineType;
    private Double rating;
    @Lob @Column(columnDefinition="TEXT")
    private String description;
    private String address;
    private Double latitude;
    private Double longitude;
    private String imageUrl;
}
