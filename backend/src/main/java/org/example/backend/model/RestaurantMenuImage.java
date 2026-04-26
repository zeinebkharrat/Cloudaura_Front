package org.example.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@Entity
@Table(name = "restaurant_menu_images")
public class RestaurantMenuImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer menuImageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnoreProperties({"menuImages", "city"})
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @Column(nullable = false, length = 2048)
    private String imageUrl;

    @Column(nullable = false)
    private Integer displayOrder;
}