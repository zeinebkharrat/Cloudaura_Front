package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Data
@Entity
@Table(
        name = "passport_city_stamp",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_passport_city", columnNames = {"passport_id", "city_id"})
        }
)
public class PassportCityStamp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stamp_id")
    private Integer stampId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "passport_id", nullable = false)
    private UserDigitalPassPort passport;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "city_id", nullable = false)
    private City city;

    @Column(name = "visit_count", nullable = false)
    private Integer visitCount;

    @Column(name = "first_visited_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date firstVisitedAt;

    @Column(name = "last_visited_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date lastVisitedAt;

    @Column(name = "emblem_key", length = 120)
    private String emblemKey;

    @Column(name = "memory_note", columnDefinition = "TEXT")
    private String memoryNote;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;
}
