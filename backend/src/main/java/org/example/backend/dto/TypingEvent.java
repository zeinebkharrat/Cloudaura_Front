package org.example.backend.dto;

public record TypingEvent(
        Integer chatRoomId,
        Integer userId,
        String username,
        boolean typing
) {
}
