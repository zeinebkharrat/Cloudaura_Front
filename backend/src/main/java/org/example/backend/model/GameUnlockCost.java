package org.example.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "game_unlock_costs")
public class GameUnlockCost {
    @Id
    private String gameId;
    
    private Integer costPoints;

    public GameUnlockCost() {}

    public GameUnlockCost(String gameId, Integer costPoints) {
        this.gameId = gameId;
        this.costPoints = costPoints;
    }

    public String getGameId() {
        return gameId;
    }

    public void setGameId(String gameId) {
        this.gameId = gameId;
    }

    public Integer getCostPoints() {
        return costPoints;
    }

    public void setCostPoints(Integer costPoints) {
        this.costPoints = costPoints;
    }
}
