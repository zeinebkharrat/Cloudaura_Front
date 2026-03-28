package org.example.backend.service;

import org.example.backend.model.ChatRoom;
import org.example.backend.repository.ChatRoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class ChatRoomService implements IChatRoomService {

    @Autowired
    ChatRoomRepository chatRoomRepo;

    @Override
    public List<ChatRoom> retrieveAllChatRooms() {
        return chatRoomRepo.findAll();
    }

    @Override
    public ChatRoom addChatRoom(ChatRoom chatRoom) {
        chatRoom.setCreatedAt(new Date());
        return chatRoomRepo.save(chatRoom);
    }

    @Override
    public ChatRoom updateChatRoom(ChatRoom chatRoom) {
        return chatRoomRepo.save(chatRoom);
    }

    @Override
    public ChatRoom retrieveChatRoom(Integer chatRoomId) {
        return chatRoomRepo.findById(chatRoomId).orElse(null);
    }

    @Override
    public void removeChatRoom(Integer chatRoomId) {
        chatRoomRepo.deleteById(chatRoomId);
    }

    @Override
    public ChatRoom createRoomIfNotExists(String name) {
        Optional<ChatRoom> existing = chatRoomRepo.findByName(name);

        if (existing.isPresent()) {
            return existing.get();
        }

        ChatRoom newRoom = new ChatRoom();
        newRoom.setName(name);
        newRoom.setCreatedAt(new Date());

        return chatRoomRepo.save(newRoom);
    }
}