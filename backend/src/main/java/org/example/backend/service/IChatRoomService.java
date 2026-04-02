package org.example.backend.service;

import org.example.backend.dto.ConversationResponse;
import org.example.backend.model.ChatRoom;

import java.util.List;

public interface IChatRoomService {
    List<ChatRoom> retrieveAllChatRooms();
    ChatRoom addChatRoom(ChatRoom chatRoom);
    ChatRoom updateChatRoom(ChatRoom chatRoom);
    ChatRoom retrieveChatRoom(Integer chatRoomId);
    void removeChatRoom(Integer chatRoomId);

    // Custom methods
    ChatRoom createRoomIfNotExists(String name);

    // DM messaging methods
    ChatRoom getOrCreateChatRoom(Integer currentUserId, Integer targetUserId);
    List<ConversationResponse> getConversations(Integer userId);
    void markMessagesAsSeen(Integer chatRoomId, Integer userId);
    boolean isUserInChatRoom(Integer chatRoomId, Integer userId);
}