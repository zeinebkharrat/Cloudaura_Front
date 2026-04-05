package org.example.backend.dto;

public record SendMessageRequest(
        Integer chatRoomId,
        Integer receiverId,
        String encryptedMessage,
        String encryptedKey,
        String iv,
        String content
) {
}
