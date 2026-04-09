package org.example.backend.dto.gamification;

import org.example.backend.model.LudificationGameKind;

public record DailyChallengeRequest(
        String title,
        String description,
        Integer pointsReward,
        LudificationGameKind gameKind,
        Integer targetId,
        Boolean active) {}
