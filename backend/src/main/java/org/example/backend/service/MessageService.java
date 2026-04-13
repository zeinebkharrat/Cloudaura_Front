package org.example.backend.service;

import org.example.backend.dto.MessageResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.ChatRoom;
import org.example.backend.model.Message;
import org.example.backend.model.User;
import org.example.backend.repository.ChatRoomRepository;
import org.example.backend.repository.MessageRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    public MessageResponse sendMessage(Integer chatRoomId,
                                       Integer senderId,
                                       Integer receiverId,
                                       String encryptedMessage,
                                       String encryptedKey,
                                       String iv,
                                       String legacyContent) {
        ChatRoom chatRoom = chatRoomRepo.findById(chatRoomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));
        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        if (receiverId != null) {
            userRepo.findById(receiverId)
                    .orElseThrow(() -> new RuntimeException("Receiver not found"));
        }

        Message message = new Message();
        message.setChatRoom(chatRoom);
        message.setSender(sender);
        boolean hasV2Payload = encryptedMessage != null && !encryptedMessage.isBlank()
                && encryptedKey != null && !encryptedKey.isBlank()
                && iv != null && !iv.isBlank();

        if (hasV2Payload) {
            message.setContent(encryptedMessage);
            message.setEncryptedKey(encryptedKey);
            message.setEncryptionIv(iv);
        } else {
            message.setContent(legacyContent);
            message.setEncryptedKey(null);
            message.setEncryptionIv(null);
        }
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
        message.setEncryptedKey(null);
        message.setEncryptionIv(null);
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

    @Override
    @Transactional
    public void deleteOwnMessage(Integer chatRoomId, Integer messageId, Integer userId) {
        Message message = messageRepo.findByMessageIdAndChatRoomChatRoomId(messageId, chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("api.error.chat.message_not_found"));

        User sender = message.getSender();
        if (sender == null || !sender.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.chat.message_delete_forbidden");
        }

        messageRepo.delete(message);
    }

    @Override
    @Transactional
    public int purgeMessagesOlderThanHours(int hours) {
        long cutoffMillis = System.currentTimeMillis() - (hours * 3600_000L);
        return messageRepo.deleteAllOlderThan(new Date(cutoffMillis));
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
                message.getEncryptedKey(),
                message.getEncryptionIv(),
                message.getMessageType(),
                message.getVoiceUrl(),
                message.getVoiceDurationSec(),
                message.getSentAt()
        );
    }
}