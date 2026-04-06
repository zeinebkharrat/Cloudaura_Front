package org.example.backend.dto.gamification;

import java.util.Date;
import java.util.List;

public record TournamentRequest(
        String title,
        String description,
        Date startsAt,
        Date endsAt,
        Integer winnerBadgeId,
        List<TournamentRoundRequest> rounds) {}
