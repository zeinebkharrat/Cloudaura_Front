package org.example.backend.dto.ludification;

public record QuizQuestionInput(
        Integer orderIndex,
        String questionText,
        String imageUrl,
        String optionsJson,
        Integer correctOptionIndex) {}
