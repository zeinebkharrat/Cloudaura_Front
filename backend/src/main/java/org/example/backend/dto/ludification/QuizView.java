package org.example.backend.dto.ludification;

import org.example.backend.model.QuizQuestion;

import java.util.Date;
import java.util.List;

public record QuizView(
        Integer quizId,
        String title,
        String description,
        Boolean published,
        Date createdAt,
        List<QuizQuestion> questions) {}
