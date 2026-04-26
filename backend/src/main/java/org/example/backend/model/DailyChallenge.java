package org.example.backend.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "daily_challenges")
public class DailyChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer challengeId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private Integer pointsReward = 10;

    @Temporal(TemporalType.TIMESTAMP)
    private Date validFrom;

    @Temporal(TemporalType.TIMESTAMP)
    private Date validTo;

    /** Stocké en String pour éviter les erreurs de désérialisation Hibernate si l'Enum change. */
    @Column(name = "game_kind", nullable = false, length = 50)
    private String gameKind;

    /** Selon gameKind : quizId, nodeId, crosswordId, puzzleId… ; null = tout jeu de ce type. */
    private Integer targetId;

    @Column(nullable = false)
    private Boolean active = true;

    public Integer getChallengeId() {
        return challengeId;
    }

    public void setChallengeId(Integer challengeId) {
        this.challengeId = challengeId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getPointsReward() {
        return pointsReward;
    }

    public void setPointsReward(Integer pointsReward) {
        this.pointsReward = pointsReward;
    }

    public Date getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(Date validFrom) {
        this.validFrom = validFrom;
    }

    public Date getValidTo() {
        return validTo;
    }

    public void setValidTo(Date validTo) {
        this.validTo = validTo;
    }

    /** Retourne l'Enum correspondant au String stocké. */
    public LudificationGameKind getGameKind() {
        if (gameKind == null || gameKind.isBlank()) return null;
        try {
            return LudificationGameKind.valueOf(gameKind);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Stocke le nom de l'Enum en String. */
    public void setGameKind(LudificationGameKind kind) {
        this.gameKind = kind == null ? null : kind.name();
    }

    public Integer getTargetId() {
        return targetId;
    }

    public void setTargetId(Integer targetId) {
        this.targetId = targetId;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
