package org.example.backend.controller;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ApiResponse;
import org.example.backend.model.OrderEntity;
import org.example.backend.model.OrderStatus;
import org.example.backend.model.ReservationStatus;
import org.example.backend.model.TransportReservation;
import org.example.backend.model.User;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.AuditLogRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.OrderEntityRepository;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.RestaurantRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final UserRepository userRepository;
    private final ActivityRepository activityRepository;
    private final EventRepository eventRepository;
    private final AccommodationRepository accommodationRepository;
    private final TransportRepository transportRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityReservationRepository activityReservationRepository;
    private final EventReservationRepository eventReservationRepository;
    private final ReservationRepository reservationRepository;
    private final TransportReservationRepository transportReservationRepository;
    private final OrderEntityRepository orderEntityRepository;
    private final AuditLogRepository auditLogRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ApiResponse<AdminDashboardStatsResponse> getStats(@RequestParam(defaultValue = "30") int periodDays) {
        int days = normalizePeriod(periodDays);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime rangeStart = now.minusDays(days);
        LocalDateTime previousStart = rangeStart.minusDays(days);

        long usersCount = userRepository.count();
        long activitiesCount = activityRepository.count();
        long eventsCount = eventRepository.count();
        long accommodationsCount = accommodationRepository.count();
        long transportsCount = transportRepository.count();
        long restaurantsCount = restaurantRepository.count();

        long activityBookings = activityReservationRepository.count();
        long eventBookings = eventReservationRepository.count();
        long accommodationBookings = reservationRepository.count();
        long transportBookings = transportReservationRepository.count();
        long shopOrdersCount = orderEntityRepository.count();
        long totalBookings = activityBookings + eventBookings + accommodationBookings + transportBookings;

        double activityRevenue = sumDouble(
                "select coalesce(sum(ar.totalPrice), 0) from ActivityReservation ar where ar.status = :status",
                "status",
                ReservationStatus.CONFIRMED);
        double eventRevenue = sumDouble(
                "select coalesce(sum(er.totalAmount), 0) from EventReservation er where er.status = :status",
                "status",
                ReservationStatus.CONFIRMED);
        double accommodationRevenue = sumDouble(
                "select coalesce(sum(r.totalPrice), 0) from Reservation r where r.status = :status",
                "status",
                ReservationStatus.CONFIRMED);
        double transportRevenue = sumDouble(
                "select coalesce(sum(tr.totalPrice), 0) from TransportReservation tr where tr.status = :status",
                "status",
                TransportReservation.ReservationStatus.CONFIRMED);
        double shopRevenue = sumDouble(
                "select coalesce(sum(o.totalAmount), 0) from OrderEntity o where o.status <> :cancelledStatus",
                "cancelledStatus",
                OrderStatus.CANCELLED);
        double totalRevenue = activityRevenue + eventRevenue + accommodationRevenue + transportRevenue + shopRevenue;

        long activeListings = activitiesCount + eventsCount + accommodationsCount + transportsCount + restaurantsCount;
        long reportCount = auditLogRepository.count();

        long usersInPeriod = countLong(
                "select count(u) from User u where u.createdAt is not null and u.createdAt >= :start and u.createdAt < :end",
                toDate(rangeStart),
                toDate(now));

        long usersInPreviousPeriod = countLong(
                "select count(u) from User u where u.createdAt is not null and u.createdAt >= :start and u.createdAt < :end",
                toDate(previousStart),
                toDate(rangeStart));

        long bookingsInPeriod = countBookingsInRange(rangeStart, now);
        long bookingsInPreviousPeriod = countBookingsInRange(previousStart, rangeStart);

        double revenueInPeriod = sumRevenueInRange(rangeStart, now);
        double revenueInPreviousPeriod = sumRevenueInRange(previousStart, rangeStart);

        long confirmedBookings = countConfirmedBookings();
        long pendingBookings = countPendingBookings();
        long cancelledBookings = countCancelledBookings();

        List<TrendPoint> trend = buildTrend(days, now);
        List<SplitPoint> categorySplit = List.of(
                new SplitPoint("Accommodations", accommodationsCount),
                new SplitPoint("Transport", transportsCount),
                new SplitPoint("Activities", activitiesCount),
                new SplitPoint("Events", eventsCount),
                new SplitPoint("Restaurants", restaurantsCount)
        );

        List<SplitPoint> bookingSourceSplit = List.of(
                new SplitPoint("Activities", activityBookings),
                new SplitPoint("Events", eventBookings),
                new SplitPoint("Accommodations", accommodationBookings),
                new SplitPoint("Transport", transportBookings),
                new SplitPoint("Shop Orders", shopOrdersCount)
        );

        List<RecentActivityItem> recentActivity = buildRecentActivity();

        return ApiResponse.success(new AdminDashboardStatsResponse(
                days,
                new OverviewKpis(
                        usersCount,
                        totalBookings,
                        round2(totalRevenue),
                        reportCount,
                        activeListings
                ),
                new PeriodKpis(
                        usersInPeriod,
                        bookingsInPeriod,
                        round2(revenueInPeriod),
                        shopOrdersCount
                ),
                new GrowthKpis(
                        percentageDelta(usersInPeriod, usersInPreviousPeriod),
                        percentageDelta(bookingsInPeriod, bookingsInPreviousPeriod),
                        percentageDelta(revenueInPeriod, revenueInPreviousPeriod)
                ),
                new StatusBreakdown(confirmedBookings, pendingBookings, cancelledBookings),
                new InventoryBreakdown(activitiesCount, eventsCount, accommodationsCount, transportsCount, restaurantsCount),
                trend,
                categorySplit,
                bookingSourceSplit,
                recentActivity
        ));
    }

    private int normalizePeriod(int value) {
        if (value <= 7) {
            return 7;
        }
        if (value <= 30) {
            return 30;
        }
        if (value <= 90) {
            return 90;
        }
        if (value <= 180) {
            return 180;
        }
        return 365;
    }

    private List<TrendPoint> buildTrend(int days, LocalDateTime now) {
        int buckets = days >= 180 ? 6 : 7;
        long bucketSpan = Math.max(1, Math.round((double) days / buckets));
        List<TrendPoint> trend = new ArrayList<>();

        for (int i = buckets - 1; i >= 0; i--) {
            LocalDateTime bucketStart = now.minusDays(bucketSpan * (i + 1L));
            LocalDateTime bucketEnd = now.minusDays(bucketSpan * i);

            long totalBookings = countBookingsInRange(bucketStart, bucketEnd);
            double revenue = sumRevenueInRange(bucketStart, bucketEnd);

            String label;
            if (days >= 180) {
                LocalDate month = bucketStart.toLocalDate().withDayOfMonth(1);
                label = month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            } else {
                LocalDate day = bucketEnd.toLocalDate();
                label = day.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH) + " " + day.getDayOfMonth();
            }

            trend.add(new TrendPoint(label, totalBookings, round2(revenue)));
        }

        return trend;
    }

    private long countBookingsInRange(LocalDateTime start, LocalDateTime end) {
        long activityCount = countLong(
                "select count(ar) from ActivityReservation ar where ar.reservationDate >= :start and ar.reservationDate < :end",
                toDate(start),
                toDate(end));

        long eventCount = countLong(
                "select count(er) from EventReservation er where er.event.startDate >= :start and er.event.startDate < :end",
                toDate(start),
                toDate(end));

        long accommodationCount = countLong(
                "select count(r) from Reservation r where r.checkInDate >= :start and r.checkInDate < :end",
                start,
                end);

        long transportCount = countLong(
                "select count(tr) from TransportReservation tr where coalesce(tr.createdAt, tr.travelDate) >= :start and coalesce(tr.createdAt, tr.travelDate) < :end",
                start,
                end);

        return activityCount + eventCount + accommodationCount + transportCount;
    }

    private double sumRevenueInRange(LocalDateTime start, LocalDateTime end) {
        double activity = sumDoubleRange(
                "select coalesce(sum(ar.totalPrice), 0) from ActivityReservation ar where ar.status = :status and ar.reservationDate >= :start and ar.reservationDate < :end",
                ReservationStatus.CONFIRMED,
                toDate(start),
                toDate(end),
                true);

        double event = sumDoubleRange(
                "select coalesce(sum(er.totalAmount), 0) from EventReservation er where er.status = :status and er.event.startDate >= :start and er.event.startDate < :end",
                ReservationStatus.CONFIRMED,
                toDate(start),
                toDate(end),
                true);

        double accommodation = sumDoubleRange(
                "select coalesce(sum(r.totalPrice), 0) from Reservation r where r.status = :status and r.checkInDate >= :start and r.checkInDate < :end",
                ReservationStatus.CONFIRMED,
                start,
                end,
                false);

        double transport = sumDoubleRange(
                "select coalesce(sum(tr.totalPrice), 0) from TransportReservation tr where tr.status = :status and coalesce(tr.createdAt, tr.travelDate) >= :start and coalesce(tr.createdAt, tr.travelDate) < :end",
                TransportReservation.ReservationStatus.CONFIRMED,
                start,
                end,
                false);

        double shop = sumDoubleRange(
                "select coalesce(sum(o.totalAmount), 0) from OrderEntity o where o.status <> :status and o.createdAt >= :start and o.createdAt < :end",
                OrderStatus.CANCELLED,
                toDate(start),
                toDate(end),
                true);

        return activity + event + accommodation + transport + shop;
    }

    private long countConfirmedBookings() {
        return countLong("select count(ar) from ActivityReservation ar where ar.status = :status", "status", ReservationStatus.CONFIRMED)
                + countLong("select count(er) from EventReservation er where er.status = :status", "status", ReservationStatus.CONFIRMED)
                + countLong("select count(r) from Reservation r where r.status = :status", "status", ReservationStatus.CONFIRMED)
                + countLong("select count(tr) from TransportReservation tr where tr.status = :status", "status", TransportReservation.ReservationStatus.CONFIRMED);
    }

    private long countPendingBookings() {
        return countLong("select count(ar) from ActivityReservation ar where ar.status = :status", "status", ReservationStatus.PENDING)
                + countLong("select count(er) from EventReservation er where er.status = :status", "status", ReservationStatus.PENDING)
                + countLong("select count(r) from Reservation r where r.status = :status", "status", ReservationStatus.PENDING)
                + countLong("select count(tr) from TransportReservation tr where tr.status = :status", "status", TransportReservation.ReservationStatus.PENDING);
    }

    private long countCancelledBookings() {
        return countLong("select count(ar) from ActivityReservation ar where ar.status = :status", "status", ReservationStatus.CANCELLED)
                + countLong("select count(er) from EventReservation er where er.status = :status", "status", ReservationStatus.CANCELLED)
                + countLong("select count(r) from Reservation r where r.status = :status", "status", ReservationStatus.CANCELLED)
                + countLong("select count(tr) from TransportReservation tr where tr.status = :status", "status", TransportReservation.ReservationStatus.CANCELLED);
    }

    private List<RecentActivityItem> buildRecentActivity() {
        List<FeedEvent> feed = new ArrayList<>();

        List<User> latestUsers = entityManager.createQuery(
                        "select u from User u where u.createdAt is not null order by u.createdAt desc",
                        User.class)
                .setMaxResults(8)
                .getResultList();

        for (User user : latestUsers) {
            Date createdAt = user.getCreatedAt();
            if (createdAt == null) {
                continue;
            }

            String display = (safe(user.getFirstName()) + " " + safe(user.getLastName())).trim();
            if (display.isBlank()) {
                display = safe(user.getUsername());
            }

            feed.add(new FeedEvent(
                    createdAt.toInstant(),
                    "user",
                    display + " joined YallaTN+",
                    "New registered account"
            ));
        }

        List<OrderEntity> latestOrders = entityManager.createQuery(
                        "select o from OrderEntity o where o.createdAt is not null order by o.createdAt desc",
                        OrderEntity.class)
                .setMaxResults(8)
                .getResultList();

        for (OrderEntity order : latestOrders) {
            Date createdAt = order.getCreatedAt();
            if (createdAt == null) {
                continue;
            }

            String amount = order.getTotalAmount() == null ? "0" : String.format(Locale.ENGLISH, "%.2f", order.getTotalAmount());
            feed.add(new FeedEvent(
                    createdAt.toInstant(),
                    "order",
                    "New artisan order #" + order.getOrderId(),
                    amount + " TND • " + safe(order.getStatus() == null ? "PENDING" : order.getStatus().name())
            ));
        }

        return feed.stream()
                .sorted(Comparator.comparing(FeedEvent::at).reversed())
                .limit(10)
                .map(event -> new RecentActivityItem(
                        event.type(),
                        event.title(),
                        event.subtitle(),
                        timeAgo(event.at())
                ))
                .toList();
    }

    private long countLong(String jpql, Object start, Object end) {
        Long value = entityManager.createQuery(jpql, Long.class)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
        return value == null ? 0L : value;
    }

    private long countLong(String jpql, String parameterName, Object value) {
        Long result = entityManager.createQuery(jpql, Long.class)
                .setParameter(parameterName, value)
                .getSingleResult();
        return result == null ? 0L : result;
    }

    private double sumDouble(String jpql, String parameterName, Object parameterValue) {
        Double value = entityManager.createQuery(jpql, Double.class)
                .setParameter(parameterName, parameterValue)
                .getSingleResult();
        return value == null ? 0D : value;
    }

    private double sumDoubleRange(String jpql, Object status, Object start, Object end, boolean dateBased) {
        Double value = entityManager.createQuery(jpql, Double.class)
                .setParameter("status", status)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
        return value == null ? 0D : value;
    }

    private static Date toDate(LocalDateTime value) {
        return Date.from(value.atZone(ZoneId.systemDefault()).toInstant());
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static double percentageDelta(double current, double previous) {
        if (previous <= 0) {
            return current > 0 ? 100.0 : 0.0;
        }
        return round2(((current - previous) / previous) * 100.0);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String timeAgo(Instant then) {
        long seconds = Math.max(1, java.time.Duration.between(then, Instant.now()).getSeconds());
        if (seconds < 60) {
            return seconds + "s ago";
        }
        long minutes = seconds / 60;
        if (minutes < 60) {
            return minutes + "m ago";
        }
        long hours = minutes / 60;
        if (hours < 24) {
            return hours + "h ago";
        }
        long days = hours / 24;
        return days + "d ago";
    }

    public record AdminDashboardStatsResponse(
            int periodDays,
            OverviewKpis overview,
            PeriodKpis period,
            GrowthKpis growth,
            StatusBreakdown status,
            InventoryBreakdown inventory,
            List<TrendPoint> trend,
            List<SplitPoint> categorySplit,
            List<SplitPoint> bookingSourceSplit,
            List<RecentActivityItem> recentActivity
    ) {}

    public record OverviewKpis(
            long registeredUsers,
            long totalBookings,
            double totalRevenue,
            long reports,
            long activeListings
    ) {}

    public record PeriodKpis(
            long newUsers,
            long bookings,
            double revenue,
            long orders
    ) {}

    public record GrowthKpis(
            double usersPct,
            double bookingsPct,
            double revenuePct
    ) {}

    public record StatusBreakdown(
            long confirmed,
            long pending,
            long cancelled
    ) {}

    public record InventoryBreakdown(
            long activities,
            long events,
            long accommodations,
            long transports,
            long restaurants
    ) {}

    public record TrendPoint(String label, long bookings, double revenue) {}

    public record SplitPoint(String label, long value) {}

    public record RecentActivityItem(
            String type,
            String title,
            String subtitle,
            String timeAgo
    ) {}

    private record FeedEvent(Instant at, String type, String title, String subtitle) {}
}
