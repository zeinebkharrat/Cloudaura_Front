package org.example.backend.service;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Service
public class ChatbotConversationMemoryService {

    private static final int MAX_LINES = 24;
    private static final int MAX_LINE_LENGTH = 1800;
    private static final Pattern SESSION_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._-]{8,128}$");

    private final Map<String, Deque<String>> conversations = new ConcurrentHashMap<>();

    public List<String> resolveConversation(String authorizationHeader, String clientSessionId, List<String> fallbackConversation) {
        List<String> stored = getConversation(authorizationHeader, clientSessionId);
        if (!stored.isEmpty()) {
            return stored;
        }
        return sanitizeConversation(fallbackConversation);
    }

    public List<String> getConversation(String authorizationHeader, String clientSessionId) {
        String key = buildConversationKey(authorizationHeader, clientSessionId);
        if (key == null) {
            return List.of();
        }
        Deque<String> history = conversations.get(key);
        if (history == null || history.isEmpty()) {
            return List.of();
        }

        synchronized (history) {
            return List.copyOf(history);
        }
    }

    public void appendExchange(String authorizationHeader, String clientSessionId, String question, String answer) {
        String key = buildConversationKey(authorizationHeader, clientSessionId);
        if (key == null) {
            return;
        }
        Deque<String> history = conversations.computeIfAbsent(key, unused -> new ArrayDeque<>());

        synchronized (history) {
            String userLine = toConversationLine("user", question);
            if (userLine != null) {
                history.addLast(userLine);
            }

            String assistantLine = toConversationLine("assistant", answer);
            if (assistantLine != null) {
                history.addLast(assistantLine);
            }

            while (history.size() > MAX_LINES) {
                history.removeFirst();
            }
        }
    }

    public void clearConversation(String authorizationHeader, String clientSessionId) {
        String key = buildConversationKey(authorizationHeader, clientSessionId);
        if (key == null) {
            return;
        }
        conversations.remove(key);
    }

    private List<String> sanitizeConversation(List<String> input) {
        if (input == null || input.isEmpty()) {
            return List.of();
        }

        List<String> cleaned = input.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(line -> !line.isBlank())
            .map(this::truncate)
            .toList();

        if (cleaned.isEmpty()) {
            return List.of();
        }

        int fromIndex = Math.max(0, cleaned.size() - MAX_LINES);
        return List.copyOf(new ArrayList<>(cleaned.subList(fromIndex, cleaned.size())));
    }

    private String buildConversationKey(String authorizationHeader, String clientSessionId) {
        String bearerToken = extractBearerToken(authorizationHeader);
        if (bearerToken != null) {
            return "auth:" + sha256Base64Url(bearerToken);
        }

        String normalizedSessionId = normalizeSessionId(clientSessionId);
        if (normalizedSessionId != null) {
            return "anon:" + normalizedSessionId;
        }

        return null;
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null) {
            return null;
        }

        String header = authorizationHeader.trim();
        if (header.length() < 8 || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }

        String token = header.substring(7).trim();
        return token.isBlank() ? null : token;
    }

    private String normalizeSessionId(String clientSessionId) {
        if (clientSessionId == null) {
            return null;
        }

        String normalized = clientSessionId.trim();
        if (!SESSION_ID_PATTERN.matcher(normalized).matches()) {
            return null;
        }

        return normalized;
    }

    private String toConversationLine(String role, String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return role + ": " + truncate(text.trim());
    }

    private String truncate(String value) {
        if (value.length() <= MAX_LINE_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_LINE_LENGTH);
    }

    private String sha256Base64Url(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm is not available", ex);
        }
    }
}
