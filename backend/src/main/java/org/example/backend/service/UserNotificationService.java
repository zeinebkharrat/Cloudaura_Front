package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.User;
import org.example.backend.model.UserNotification;
import org.example.backend.repository.UserNotificationRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserNotificationService {

    private final UserNotificationRepository userNotificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void notifyReservation(
            Integer userId,
            String reservationType,
            Integer reservationId,
            String title,
            String message,
            String route
    ) {
        if (userId == null) {
            return;
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return;
        }

        UserNotification notification = new UserNotification();
        notification.setUser(userOpt.get());
        notification.setType("RESERVATION");
        notification.setTitle(title == null || title.isBlank() ? "Reservation update" : title.trim());
        notification.setMessage(message == null || message.isBlank() ? "Your reservation has been updated." : message.trim());
        notification.setRoute(route == null || route.isBlank() ? "/mes-reservations" : route.trim());
        notification.setReservationType(reservationType == null ? null : reservationType.trim().toUpperCase(Locale.ROOT));
        notification.setReservationId(reservationId);
        notification.setReadFlag(false);
        notification.setCreatedAt(LocalDateTime.now());

        UserNotification saved = userNotificationRepository.save(notification);
        pushRealtime(saved);
    }

    @Transactional
    public void notifyPostInteraction(Integer targetUserId, Integer postId, String interactionType, User actor) {
        if (targetUserId == null || postId == null || interactionType == null || actor == null || actor.getUserId() == null) {
            return;
        }
        if (targetUserId.equals(actor.getUserId())) {
            return;
        }

        Optional<User> targetUserOpt = userRepository.findById(targetUserId);
        if (targetUserOpt.isEmpty()) {
            return;
        }

        String normalizedType = interactionType.trim().toUpperCase(Locale.ROOT);
        Optional<UserNotification> existingOpt = userNotificationRepository
                .findFirstByUserUserIdAndTypeAndReservationTypeAndReservationIdOrderByCreatedAtDesc(
                        targetUserId,
                        normalizedType,
                        "POST",
                        postId
                );

        UserNotification notification = existingOpt.orElseGet(UserNotification::new);
        if (notification.getNotificationId() == null) {
            notification.setUser(targetUserOpt.get());
            notification.setType(normalizedType);
            notification.setReservationType("POST");
            notification.setReservationId(postId);
            notification.setRoute("/communaute");
            notification.setInteractionCount(0);
        }

        int nextCount = (notification.getInteractionCount() == null ? 0 : notification.getInteractionCount()) + 1;
        String actorName = resolveActorName(actor);

        notification.setInteractionCount(nextCount);
        notification.setLastActorUserId(actor.getUserId());
        notification.setLastActorName(actorName);
        notification.setLastActorAvatarUrl(actor.getProfileImageUrl());
        notification.setTitle(buildSocialTitle(normalizedType));
        notification.setMessage(buildSocialMessage(normalizedType, actorName, nextCount));
        notification.setReadFlag(false);
        notification.setCreatedAt(LocalDateTime.now());

        UserNotification saved = userNotificationRepository.save(notification);
        pushRealtime(saved);
    }

    @Transactional(readOnly = true)
    public List<UserNotification> listByUser(Integer userId) {
        return userNotificationRepository.findByUserUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Integer userId) {
        return userNotificationRepository.countByUserUserIdAndReadFlagFalse(userId);
    }

    @Transactional
    public boolean markAsRead(Integer userId, Integer notificationId) {
        return userNotificationRepository
                .findByNotificationIdAndUserUserId(notificationId, userId)
                .map(n -> {
                    if (!n.isReadFlag()) {
                        n.setReadFlag(true);
                        userNotificationRepository.save(n);
                    }
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public int markAllAsRead(Integer userId) {
        return userNotificationRepository.markAllAsReadForUser(userId);
    }

    private void pushRealtime(UserNotification notification) {
        User user = notification.getUser();
        if (user == null) {
            return;
        }

        Map<String, Object> payload = toPayload(notification);
        String username = user.getUsername();
        String email = user.getEmail();

        try {
            if (username != null && !username.isBlank()) {
                messagingTemplate.convertAndSendToUser(username, "/queue/notifications", payload);
            }
            if (email != null && !email.isBlank() && (username == null || !email.equalsIgnoreCase(username))) {
                messagingTemplate.convertAndSendToUser(email, "/queue/notifications", payload);
            }
        } catch (Exception ex) {
            log.warn("Could not push realtime notification to websocket: {}", ex.getMessage());
        }
    }

    public Map<String, Object> toPayload(UserNotification n) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("notificationId", n.getNotificationId());
        row.put("type", n.getType());
        row.put("title", n.getTitle());
        row.put("message", n.getMessage());
        row.put("route", n.getRoute());
        row.put("reservationType", n.getReservationType());
        row.put("reservationId", n.getReservationId());
        row.put("interactionCount", n.getInteractionCount());
        row.put("lastActorUserId", n.getLastActorUserId());
        row.put("lastActorName", n.getLastActorName());
        row.put("lastActorAvatarUrl", n.getLastActorAvatarUrl());
        row.put("read", n.isReadFlag());
        row.put("createdAt", n.getCreatedAt());
        return row;
    }

    private String resolveActorName(User actor) {
        String firstName = actor.getFirstName();
        if (firstName != null && !firstName.isBlank()) {
            return firstName.trim();
        }
        String username = actor.getUsername();
        if (username != null && !username.isBlank()) {
            return username.trim();
        }
        return "Someone";
    }

    private String buildSocialTitle(String type) {
        return switch (type) {
            case "POST_LIKE" -> "New likes on your post";
            case "POST_COMMENT" -> "New comments on your post";
            case "POST_REPOST" -> "Your post was reposted";
            default -> "New activity on your post";
        };
    }

    private String buildSocialMessage(String type, String actorName, int count) {
        String verb = switch (type) {
            case "POST_LIKE" -> "liked";
            case "POST_COMMENT" -> "commented on";
            case "POST_REPOST" -> "reposted";
            default -> "interacted with";
        };

        if (count <= 1) {
            return actorName + " " + verb + " your post.";
        }
        if (count == 2) {
            return actorName + " and 1 other person " + verb + " your post.";
        }
        return actorName + " and " + (count - 1) + " others " + verb + " your post.";
    }
}
