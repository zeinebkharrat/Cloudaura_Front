package org.example.backend.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "quizzes")
public class Quiz {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer quizId;
    private String title;
    private String description;
    private Boolean published;
    private Date createdAt;

    /** URL ou data URL (base64) — MEDIUMTEXT pour éviter la troncature MySQL sur les longues chaînes. */
    @Column(columnDefinition = "MEDIUMTEXT")
    private String coverImageUrl;

    /**
     * Durée totale du quiz en secondes (multiple de 3 recommandé : le temps est découpé en 3 tiers pour les étoiles).
     * Défaut côté service si absent : 60.
     */
    private Integer timeLimitSeconds;

    public Integer getQuizId() {
        return quizId;
    }

    public void setQuizId(Integer quizId) {
        this.quizId = quizId;
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

    public Boolean getPublished() {
        return published;
    }

    public void setPublished(Boolean published) {
        this.published = published;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public void setCoverImageUrl(String coverImageUrl) {
        this.coverImageUrl = coverImageUrl;
    }

    public Integer getTimeLimitSeconds() {
        return timeLimitSeconds;
    }

    public void setTimeLimitSeconds(Integer timeLimitSeconds) {
        this.timeLimitSeconds = timeLimitSeconds;
    }
}
