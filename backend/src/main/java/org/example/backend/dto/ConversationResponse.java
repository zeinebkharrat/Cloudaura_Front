package org.example.backend.dto;

import java.util.Date;

public record ConversationResponse(
        Integer chatRoomId,
        Integer otherUserId,
        String otherUsername,
        String otherUserImage,
        String lastMessage,
        Date lastMessageTime,
        long unreadCount
) {
}
