package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Data
@Entity
@Table(
        name = "passport_achievement",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_passport_achievement_code", columnNames = {"passport_id", "achievement_code"})
        }
)
public class PassportAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "achievement_id")
    private Integer achievementId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "passport_id", nullable = false)
    private UserDigitalPassPort passport;

    @Column(name = "achievement_code", nullable = false, length = 80)
    private String achievementCode;

    @Column(name = "title", nullable = false, length = 140)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "badge_tone", length = 40)
    private String badgeTone;

    @Column(name = "unlocked_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date unlockedAt;
}
