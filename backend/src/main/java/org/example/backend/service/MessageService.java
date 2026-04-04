package org.example.backend.service;

import org.example.backend.dto.MessageResponse;
import org.example.backend.model.ChatRoom;
import org.example.backend.model.Message;
import org.example.backend.model.User;
import org.example.backend.repository.ChatRoomRepository;
import org.example.backend.repository.MessageRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

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

    // ──────────────────────────────────────────────
    // DM messaging methods
    // ──────────────────────────────────────────────

    @Override
    public MessageResponse sendMessage(Integer chatRoomId, Integer senderId, String content) {
        ChatRoom chatRoom = chatRoomRepo.findById(chatRoomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));
        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        Message message = new Message();
        message.setChatRoom(chatRoom);
        message.setSender(sender);
        message.setContent(content);
        message.setMessageType("TEXT");
        message.setVoiceUrl(null);
        message.setVoiceDurationSec(null);
        message.setSentAt(new Date());

        message = messageRepo.save(message);

        return toMessageResponse(message);
    }

    @Override
    public MessageResponse sendVoiceMessage(Integer chatRoomId, Integer senderId, String voiceUrl, Integer durationSec) {
        ChatRoom chatRoom = chatRoomRepo.findById(chatRoomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));
        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        Message message = new Message();
        message.setChatRoom(chatRoom);
        message.setSender(sender);
        message.setContent("Voice message");
        message.setMessageType("VOICE");
        message.setVoiceUrl(voiceUrl);
        message.setVoiceDurationSec(durationSec != null && durationSec > 0 ? durationSec : null);
        message.setSentAt(new Date());

        message = messageRepo.save(message);
        return toMessageResponse(message);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponse> getMessagesByChatRoomOrdered(Integer chatRoomId) {
        return messageRepo.findByChatRoomIdOrderBySentAtAscWithRelations(chatRoomId).stream()
                .map(this::toMessageResponse)
                .collect(Collectors.toList());
    }

    private MessageResponse toMessageResponse(Message message) {
        User sender = message.getSender();
        Integer senderId = sender != null ? sender.getUserId() : null;
        String senderUsername = sender != null ? sender.getUsername() : "Unknown user";
        String senderImage = sender != null ? sender.getProfileImageUrl() : null;
        return new MessageResponse(
                message.getMessageId(),
                message.getChatRoom().getChatRoomId(),
                senderId,
                senderUsername,
                senderImage,
                message.getContent(),
            message.getMessageType(),
            message.getVoiceUrl(),
            message.getVoiceDurationSec(),
                message.getSentAt()
        );
    }
}