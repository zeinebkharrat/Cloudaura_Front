package org.example.backend.model;

import org.example.backend.model.City;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * Hébergement : clé i18n catalogue {@code accommodation.{accommodationId}.name} — pas de champ {@code description}
 * sur cette entité JPA.
 */
@Entity
@Table(name = "accommodations")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Accommodation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "accommodation_id")
    private Integer accommodationId;

    @Column(nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    private AccommodationType type;

    @Column(name = "price_per_night")
    private Double pricePerNight;

    private Double rating;

    @Enumerated(EnumType.STRING)
    private AccommodationStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "city_id")
    private City city;

    @OneToMany(mappedBy = "accommodation", fetch = FetchType.LAZY)
    private List<Room> rooms;

    public enum AccommodationType { HOTEL, GUESTHOUSE, MAISON_HOTE, AUTRE, ygu, YGU }

    public enum AccommodationStatus { AVAILABLE, UNAVAILABLE, ACTIVE }
}

