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
        row.put("read", n.isReadFlag());
        row.put("createdAt", n.getCreatedAt());
        return row;
    }
}
