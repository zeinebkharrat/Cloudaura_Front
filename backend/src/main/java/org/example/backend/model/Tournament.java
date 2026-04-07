package org.example.backend.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Entity
@Table(name = "tournaments")
public class Tournament {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer tournamentId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 3000)
    private String description;

    @Temporal(TemporalType.TIMESTAMP)
    private Date startsAt;

    @Temporal(TemporalType.TIMESTAMP)
    private Date endsAt;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private TournamentStatus status = TournamentStatus.DRAFT;

    @ManyToOne
    @JoinColumn(name = "winner_badge_id")
    private Badge winnerBadge;

    @ManyToOne
    @JoinColumn(name = "winner_user_id")
    private User winnerUser;

    @OneToMany(mappedBy = "tournament", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TournamentRound> rounds = new ArrayList<>();

    public Integer getTournamentId() {
        return tournamentId;
    }

    public void setTournamentId(Integer tournamentId) {
        this.tournamentId = tournamentId;
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

    public Date getStartsAt() {
        return startsAt;
    }

    public void setStartsAt(Date startsAt) {
        this.startsAt = startsAt;
    }

    public Date getEndsAt() {
        return endsAt;
    }

    public void setEndsAt(Date endsAt) {
        this.endsAt = endsAt;
    }

    public TournamentStatus getStatus() {
        return status;
    }

    public void setStatus(TournamentStatus status) {
        this.status = status;
    }

    public Badge getWinnerBadge() {
        return winnerBadge;
    }

    public void setWinnerBadge(Badge winnerBadge) {
        this.winnerBadge = winnerBadge;
    }

    public User getWinnerUser() {
        return winnerUser;
    }

    public void setWinnerUser(User winnerUser) {
        this.winnerUser = winnerUser;
    }

    public List<TournamentRound> getRounds() {
        return rounds;
    }

    public void setRounds(List<TournamentRound> rounds) {
        this.rounds = rounds;
    }
}
