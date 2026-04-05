package org.example.backend.dto;

import java.util.Date;

public record MessageResponse(
        Integer messageId,
        Integer chatRoomId,
        Integer senderId,
        String senderUsername,
        String senderImage,
        String content,
        String encryptedKey,
        String iv,
        String messageType,
        String voiceUrl,
        Integer voiceDurationSec,
        Date sentAt
) {
}
