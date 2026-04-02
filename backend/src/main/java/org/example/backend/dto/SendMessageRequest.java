package org.example.backend.dto;

public record SendMessageRequest(
        Integer chatRoomId,
        String content
) {
}
