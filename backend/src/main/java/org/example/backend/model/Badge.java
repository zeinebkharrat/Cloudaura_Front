package org.example.backend.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "badges")
public class Badge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer badgeId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(length = 1000)
    private String iconUrl;

    @Column(length = 100)
    private String targetGameId;

    /** Stocké en String pour éviter les erreurs de désérialisation Hibernate si l'Enum change. */
    @Column(name = "target_game_kind", length = 50)
    private String targetGameKind;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = new Date();
        }
    }

    public Integer getBadgeId() {
        return badgeId;
    }

    public void setBadgeId(Integer badgeId) {
        this.badgeId = badgeId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public String getTargetGameId() {
        return targetGameId;
    }

    public void setTargetGameId(String targetGameId) {
        this.targetGameId = targetGameId;
    }

    /** Retourne l'Enum correspondant au String stocké. */
    public LudificationGameKind getTargetGameKind() {
        if (targetGameKind == null || targetGameKind.isBlank()) return null;
        try {
            return LudificationGameKind.valueOf(targetGameKind);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Stocke le nom de l'Enum en String. */
    public void setTargetGameKind(LudificationGameKind kind) {
        this.targetGameKind = kind == null ? null : kind.name();
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
