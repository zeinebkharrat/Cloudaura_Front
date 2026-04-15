package org.example.backend.dto.personalization;

import java.util.List;

public record PreferenceImageAnalysisResponse(
        String description,
        List<String> detectedInterests,
        List<String> topKeywords,
        boolean preferencesUpdated
) {
}
