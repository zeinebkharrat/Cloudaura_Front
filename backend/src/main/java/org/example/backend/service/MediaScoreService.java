package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.repository.FollowRelationRepository;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Date;
import java.util.List;

@Service
public class MediaScoreService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private FollowRelationRepository followRelationRepository;

    @Transactional
    public void recomputeUserMonthlyScore(Integer userId) {
        if (userId == null) {
            return;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime monthStart = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime nextMonthStart = monthStart.plusMonths(1);

        Date start = Date.from(monthStart.toInstant(ZoneOffset.UTC));
        Date end = Date.from(nextMonthStart.toInstant(ZoneOffset.UTC));

        Object[] aggregates = postRepository.aggregateUserPostMetricsForMonth(userId, start, end);

        double totalLikes = toDouble(aggregates, 0);
        double totalComments = toDouble(aggregates, 1);
        double totalViews = toDouble(aggregates, 2);
        double totalPosts = toDouble(aggregates, 3);
        double totalReposts = toDouble(aggregates, 4);
        double followersThisMonth = followRelationRepository.countFollowersForMonth(userId, start, end);

        double monthlyScore =
                (totalLikes * 2.0)
                        + (totalComments * 3.0)
                        + (totalViews * 0.5)
                        + (totalPosts * 1.0)
                        + (totalReposts * 4.0)
                        + (followersThisMonth * 5.0);

        if (monthlyScore > 200.0) {
            monthlyScore += 50.0;
        }

        user.setMonthlyScore(monthlyScore);
        userRepository.save(user);
    }

    @Transactional
    public void recomputeAuthorMonthlyScoreFromPost(Integer postId) {
        if (postId == null) {
            return;
        }

        Post post = postRepository.findById(postId).orElse(null);
        if (post == null || post.getAuthor() == null || post.getAuthor().getUserId() == null) {
            return;
        }

        recomputeUserMonthlyScore(post.getAuthor().getUserId());
    }

    @Transactional
    public void runMonthlyReset() {
        List<User> users = userRepository.findAll();
        if (users.isEmpty()) {
            return;
        }

        List<UserRankItem> ranked = users.stream()
                .map((user) -> new UserRankItem(
                        user,
                        safe(user.getMonthlyScore()),
                monthlyTotalViewsForUser(user.getUserId())
                ))
                .sorted(Comparator
                        .comparingDouble(UserRankItem::monthlyScore).reversed()
                .thenComparing(Comparator.comparingLong(UserRankItem::totalViews).reversed()))
                .toList();

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        for (int i = 0; i < ranked.size(); i++) {
            User user = ranked.get(i).user();
            double monthly = safe(user.getMonthlyScore());
            double lifetime = safe(user.getLifetimeScore());

            lifetime += monthly;

            if (i == 0) {
                lifetime += 100.0;
            } else if (i == 1) {
                lifetime += 50.0;
            } else if (i == 2) {
                lifetime += 20.0;
            }

            user.setLifetimeScore(lifetime);
            user.setMonthlyScore(monthly * 0.2);
            user.setLastResetDate(now);
            userRepository.save(user);
        }
    }

    public static String currentMonthKeyUtc() {
        return LocalDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }

    private long monthlyTotalViewsForUser(Integer userId) {
        if (userId == null) {
            return 0;
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime monthStart = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime nextMonthStart = monthStart.plusMonths(1);

        Date start = Date.from(monthStart.toInstant(ZoneOffset.UTC));
        Date end = Date.from(nextMonthStart.toInstant(ZoneOffset.UTC));
        Object[] aggregates = postRepository.aggregateUserPostMetricsForMonth(userId, start, end);
        return Math.round(toDouble(aggregates, 2));
    }

    private double toDouble(Object[] source, int index) {
        if (source == null || index < 0) {
            return 0.0;
        }

        Object value = resolveAggregateValue(source, index);
        if (value == null) {
            return 0.0;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        if (value instanceof String text) {
            try {
                return Double.parseDouble(text);
            } catch (NumberFormatException ignored) {
                return 0.0;
            }
        }

        return 0.0;
    }

    private Object resolveAggregateValue(Object[] source, int index) {
        if (source.length == 1 && source[0] instanceof Object[] nested) {
            return resolveAggregateValue(nested, index);
        }

        if (index >= source.length) {
            return null;
        }

        Object value = source[index];
        if (value instanceof Object[] nestedValue) {
            return resolveAggregateValue(nestedValue, index);
        }

        return value;
    }

    private double safe(Double value) {
        return value == null ? 0.0 : value;
    }

    private record UserRankItem(User user, double monthlyScore, long totalViews) {
    }
}
