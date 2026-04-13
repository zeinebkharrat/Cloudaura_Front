package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Data
@Entity
@Table(name = "user_digital_passport")
public class UserDigitalPassPort {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "passport_id")
    private Integer passportId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "passport_number", nullable = false, unique = true, length = 32)
    private String passportNumber;

    @Column(name = "travel_style_badge", length = 120)
    private String travelStyleBadge;

    @Column(name = "bio_note", columnDefinition = "TEXT")
    private String bioNote;

    @Column(name = "join_date")
    @Temporal(TemporalType.TIMESTAMP)
    private Date joinDate;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;
}
