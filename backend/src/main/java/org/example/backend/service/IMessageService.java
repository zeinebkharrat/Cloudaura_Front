package org.example.backend.service;

import org.example.backend.dto.MessageResponse;
import org.example.backend.model.Message;

import java.util.List;

public interface IMessageService {
    List<Message> retrieveAllMessages();
    Message addMessage(Message message);
    Message updateMessage(Message message);
    Message retrieveMessage(Integer messageId);
    void removeMessage(Integer messageId);

    // Custom methods
    List<Message> getMessagesByChatRoom(Integer chatRoomId);

    // DM messaging methods
    MessageResponse sendMessage(Integer chatRoomId, Integer senderId, String content);
    MessageResponse sendVoiceMessage(Integer chatRoomId, Integer senderId, String voiceUrl, Integer durationSec);
    List<MessageResponse> getMessagesByChatRoomOrdered(Integer chatRoomId);
}
