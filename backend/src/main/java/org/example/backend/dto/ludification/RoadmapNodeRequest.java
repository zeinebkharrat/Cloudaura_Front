package org.example.backend.dto.ludification;

public record RoadmapNodeRequest(
        Integer stepOrder,
        String nodeLabel,
        Integer quizId,
        Integer crosswordId,
        Integer puzzleId) {}
