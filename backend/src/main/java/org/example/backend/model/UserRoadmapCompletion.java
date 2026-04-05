package org.example.backend.model;

import jakarta.persistence.*;

import java.util.Date;

@Entity
@Table(
        name = "user_roadmap_completions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"username", "node_id"})
)
public class UserRoadmapCompletion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer completionId;

    /** Identifiant de connexion (ex. admin, user) — même logique que /api/auth/login */
    @Column(nullable = false, length = 100)
    private String username;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "node_id")
    private RoadmapNode roadmapNode;

    @Temporal(TemporalType.TIMESTAMP)
    private Date completedAt;

    private Integer score;
    private Integer maxScore;

    public Integer getCompletionId() {
        return completionId;
    }

    public void setCompletionId(Integer completionId) {
        this.completionId = completionId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public RoadmapNode getRoadmapNode() {
        return roadmapNode;
    }

    public void setRoadmapNode(RoadmapNode roadmapNode) {
        this.roadmapNode = roadmapNode;
    }

    public Date getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Date completedAt) {
        this.completedAt = completedAt;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public Integer getMaxScore() {
        return maxScore;
    }

    public void setMaxScore(Integer maxScore) {
        this.maxScore = maxScore;
    }
}
