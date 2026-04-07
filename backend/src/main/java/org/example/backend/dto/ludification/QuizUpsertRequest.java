package org.example.backend.dto.ludification;

import java.util.Date;
import java.util.List;

public record QuizUpsertRequest(
        String title,
        String description,
        Boolean published,
        Date createdAt,
        /** URL image de couverture (optionnel). */
        String coverImageUrl,
        /** Durée totale en secondes (multiple de 3 pour 3 tiers / 3 étoiles). */
        Integer timeLimitSeconds,
        List<QuizQuestionInput> questions) {}
