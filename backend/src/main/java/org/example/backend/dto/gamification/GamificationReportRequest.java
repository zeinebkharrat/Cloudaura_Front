package org.example.backend.dto.gamification;

import org.example.backend.model.LudificationGameKind;

public record GamificationReportRequest(
        LudificationGameKind gameKind,
        Integer gameId,
        Integer score,
        Integer maxScore) {}
