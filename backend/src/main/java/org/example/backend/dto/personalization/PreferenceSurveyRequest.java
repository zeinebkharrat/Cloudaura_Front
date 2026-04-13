package org.example.backend.dto.personalization;

import jakarta.validation.constraints.Size;

import java.util.List;

public record PreferenceSurveyRequest(
        @Size(max = 12) List<String> interests,
        String preferredRegion,
        String travelWith,
        String budgetLevel,
        String accommodationType,
        String transportPreference,
        String preferredCuisine
) {
}
