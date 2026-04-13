package org.example.backend.dto.gamification;

import org.example.backend.model.LudificationGameKind;

public record TournamentRoundRequest(
        Integer sequenceOrder,
        LudificationGameKind gameKind,
        Integer gameId) {}
