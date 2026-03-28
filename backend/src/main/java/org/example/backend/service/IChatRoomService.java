package org.example.backend.service;

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
}