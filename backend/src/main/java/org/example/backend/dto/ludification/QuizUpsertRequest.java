package org.example.backend.dto.ludification;

import java.util.Date;
import java.util.List;

public record QuizUpsertRequest(
        String title,
        String description,
        Boolean published,
        Date createdAt,
        List<QuizQuestionInput> questions) {}
