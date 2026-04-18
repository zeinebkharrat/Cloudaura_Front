package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Data
@Entity
@Table(
    name = "accommodation_reviews",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_accommodation_review_user", columnNames = {"accommodation_id", "user_id"})
    }
)
public class AccommodationReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer reviewId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "accommodation_id", nullable = false)
    private Accommodation accommodation;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Integer stars;

    @Lob
    @Column(columnDefinition = "TEXT", nullable = false)
    private String commentText;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String originalCommentText;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String sanitizedCommentText;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String abuseCategories;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false)
    private Date updatedAt;

    @PrePersist
    public void onCreate() {
        Date now = new Date();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = new Date();
    }
}