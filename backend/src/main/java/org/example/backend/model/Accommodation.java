package org.example.backend.model;

import org.example.backend.model.City;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

/** Hébergement : contenu descriptif et amenities désormais stockés en base. */
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

    @Column(columnDefinition = "TEXT")
    private String description;

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

        @ElementCollection(fetch = FetchType.LAZY)
        @CollectionTable(
            name = "accommodation_amenities",
            joinColumns = @JoinColumn(name = "accommodation_id")
        )
        @Column(name = "amenity", nullable = false, length = 120)
        @OrderColumn(name = "sort_order")
        @Builder.Default
        private List<String> amenities = new ArrayList<>();

    @OneToMany(mappedBy = "accommodation", fetch = FetchType.LAZY)
    private List<Room> rooms;

    public enum AccommodationType { HOTEL, GUESTHOUSE, MAISON_HOTE, AUTRE }
    public enum AccommodationStatus { AVAILABLE, UNAVAILABLE }
}
