package org.example.backend.dto;

import java.util.Date;
import java.util.List;

public record PassportResponse(
        Integer passportId,
        Integer userId,
        String displayName,
        String username,
        String nationality,
        String profileImageUrl,
        String passportNumber,
        String travelStyleBadge,
        String bioNote,
        Date joinDate,
        Date createdAt,
        Integer uniqueCitiesVisited,
        Integer totalVisits,
        List<PassportStampView> stamps,
        List<PassportAchievementView> achievements,
        List<PassportPhotoView> photos,
        List<PassportCityProgressView> cityProgress
) {
    public record PassportStampView(
            Integer stampId,
            Integer cityId,
            String cityName,
            String region,
            Integer visitCount,
            Date firstVisitedAt,
            Date lastVisitedAt,
            String emblemKey,
            String memoryNote,
            String photoUrl
    ) {}

    public record PassportAchievementView(
            Integer achievementId,
            String achievementCode,
            String title,
            String description,
            String badgeTone,
            Date unlockedAt
    ) {}

    public record PassportPhotoView(
            Integer photoId,
            Integer cityId,
            String cityName,
            String photoUrl,
            String caption,
            Date uploadedAt
    ) {}

    public record PassportCityProgressView(
            Integer cityId,
            String cityName,
            String region,
            Double latitude,
            Double longitude,
            boolean visited,
            Integer visitCount
    ) {}
}
