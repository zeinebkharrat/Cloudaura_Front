package org.example.backend.dto.personalization;

import java.util.List;

public record PersonalizedRecommendationsResponse(
        boolean preferencesCompleted,
        List<RecommendedCity> recommendedCities,
        List<RecommendedActivity> recommendedActivities,
        List<RecommendedEvent> recommendedEvents
) {
    public record RecommendedCity(
            Integer cityId,
            String name,
            String region,
            String description,
            String imageUrl,
            double score
    ) {}

    public record RecommendedActivity(
            Integer activityId,
            Integer cityId,
            String cityName,
            String name,
            String type,
            String description,
            Double price,
            String imageUrl,
            double score
    ) {}

    public record RecommendedEvent(
            Integer eventId,
            Integer cityId,
            String cityName,
            String title,
            String eventType,
            String venue,
            String startDate,
            Double price,
            String imageUrl,
            double score
    ) {}
}
