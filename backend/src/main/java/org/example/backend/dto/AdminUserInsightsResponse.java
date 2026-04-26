package org.example.backend.dto;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

public record AdminUserInsightsResponse(
        AdminUserResponse user,
        PreferenceSnapshot preferences,
        CommunitySummary community,
        ReservationSummary reservations
) {
    public record PreferenceSnapshot(
            String interests,
            String preferredRegion,
            String travelWith,
            String budgetLevel,
            Double budgetMin,
            Double budgetMax,
            String accommodationType,
            String transportPreference,
            String preferredCuisine
    ) {}

    public record CommunitySummary(
            long postsCount,
            long commentsCount,
            long likesGivenCount,
            List<CommunityItem> recentPosts,
            List<CommunityItem> recentComments,
            List<CommunityItem> recentLikes
    ) {}

    public record ReservationSummary(
            long accommodationsCount,
            long activityCount,
            long eventCount,
            long transportCount,
            List<ReservationItem> recentActivityReservations,
            List<ReservationItem> recentEventReservations
    ) {}

    public record CommunityItem(
            Integer id,
            String title,
            String subtitle,
            Date createdAt
    ) {}

    public record ReservationItem(
            Integer id,
            String title,
            String status,
            Double totalPrice,
            Date reservationDate,
            LocalDateTime reservationDateTime
    ) {}
}
