package org.example.backend.config;

import org.example.backend.service.CustomUserDetailsService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;

    // Track online users: userId -> set of session IDs (user can have multiple tabs)
    private final Map<Integer, Set<String>> onlineUsers = new ConcurrentHashMap<>();

    public WebSocketEventListener(SimpMessageSendingOperations messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal userPrincipal = accessor.getUser();

        if (userPrincipal != null) {
            Integer userId = extractUserId(userPrincipal);
            String sessionId = accessor.getSessionId();

            if (userId != null && sessionId != null) {
                onlineUsers.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
                broadcastUserStatus(userId, true);
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal userPrincipal = accessor.getUser();

        if (userPrincipal != null) {
            Integer userId = extractUserId(userPrincipal);
            String sessionId = accessor.getSessionId();

            if (userId != null && sessionId != null) {
                Set<String> sessions = onlineUsers.get(userId);
                if (sessions != null) {
                    sessions.remove(sessionId);
                    if (sessions.isEmpty()) {
                        onlineUsers.remove(userId);
                        broadcastUserStatus(userId, false);
                    }
                }
            }
        }
    }

    public boolean isUserOnline(Integer userId) {
        Set<String> sessions = onlineUsers.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    public Set<Integer> getOnlineUserIds() {
        return onlineUsers.keySet();
    }

    private void broadcastUserStatus(Integer userId, boolean online) {
        Map<String, Object> status = Map.of(
                "userId", userId,
                "online", online
        );
        messagingTemplate.convertAndSend("/topic/user-status", status);
    }

    private Integer extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken authToken) {
            Object details = authToken.getPrincipal();
            if (details instanceof CustomUserDetailsService.CustomUserDetails customDetails) {
                return customDetails.getUser().getUserId();
            }
        }
        return null;
    }
}
