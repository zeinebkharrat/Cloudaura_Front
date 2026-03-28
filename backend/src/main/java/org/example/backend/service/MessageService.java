package org.example.backend.service;

import org.example.backend.model.ChatRoom;
import org.example.backend.model.Message;
import org.example.backend.repository.ChatRoomRepository;
import org.example.backend.repository.MessageRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
public class MessageService implements IMessageService {

    @Autowired
    MessageRepository messageRepo;

    @Autowired
    ChatRoomRepository chatRoomRepo;

    @Autowired
    UserRepository userRepo;

    @Override
    public List<Message> retrieveAllMessages() {
        return messageRepo.findAll();
    }

    @Override
    public Message addMessage(Message message) {
        message.setSentAt(new Date());
        return messageRepo.save(message);
    }

    @Override
    public Message updateMessage(Message message) {
        return messageRepo.save(message);
    }

    @Override
    public Message retrieveMessage(Integer messageId) {
        return messageRepo.findById(messageId).orElse(null);
    }

    @Override
    public void removeMessage(Integer messageId) {
        messageRepo.deleteById(messageId);
    }

    @Override
    public List<Message> getMessagesByChatRoom(Integer chatRoomId) {
        ChatRoom chatRoom = chatRoomRepo.findById(chatRoomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        return messageRepo.findByChatRoom(chatRoom);
    }
}