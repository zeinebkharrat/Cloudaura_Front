package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.model.UserNotification;
import org.example.backend.service.UserIdentityResolver;
import org.example.backend.service.UserNotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final UserIdentityResolver userIdentityResolver;
    private final UserNotificationService userNotificationService;

    @GetMapping("/me")
    public ResponseEntity<?> myNotifications(Authentication authentication) {
        Integer userId = requireUserId(authentication);
        List<UserNotification> rows = userNotificationService.listByUser(userId);
        List<Map<String, Object>> payload = new ArrayList<>(rows.size());
        for (UserNotification row : rows) {
            payload.add(userNotificationService.toPayload(row));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", payload);
        body.put("unreadCount", userNotificationService.unreadCount(userId));
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<?> markRead(@PathVariable Integer notificationId, Authentication authentication) {
        Integer userId = requireUserId(authentication);
        boolean found = userNotificationService.markAsRead(userId, notificationId);
        if (!found) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Notification not found"));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllRead(Authentication authentication) {
        Integer userId = requireUserId(authentication);
        int updated = userNotificationService.markAllAsRead(userId);
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    private Integer requireUserId(Authentication authentication) {
        Integer userId = userIdentityResolver.resolveUserId(authentication);
        if (userId == null) {
            throw new AccessDeniedException("Authentication required");
        }
        return userId;
    }
}
