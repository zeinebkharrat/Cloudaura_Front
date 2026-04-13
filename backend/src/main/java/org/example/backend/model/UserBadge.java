package org.example.backend.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "user_badges")
public class UserBadge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer userBadgeId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "badge_id")
    private Badge badge;

    @ManyToOne
    @JoinColumn(name = "tournament_id")
    private Tournament tournament;

    @Temporal(TemporalType.TIMESTAMP)
    private Date earnedAt;

    @PrePersist
    void prePersist() {
        if (earnedAt == null) {
            earnedAt = new Date();
        }
    }

    public Integer getUserBadgeId() {
        return userBadgeId;
    }

    public void setUserBadgeId(Integer userBadgeId) {
        this.userBadgeId = userBadgeId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Badge getBadge() {
        return badge;
    }

    public void setBadge(Badge badge) {
        this.badge = badge;
    }

    public Tournament getTournament() {
        return tournament;
    }

    public void setTournament(Tournament tournament) {
        this.tournament = tournament;
    }

    public Date getEarnedAt() {
        return earnedAt;
    }

    public void setEarnedAt(Date earnedAt) {
        this.earnedAt = earnedAt;
    }
}
