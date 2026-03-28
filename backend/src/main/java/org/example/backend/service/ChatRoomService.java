package org.example.backend.service;

import org.example.backend.dto.ConversationResponse;
import org.example.backend.model.ChatRoom;
import org.example.backend.model.ChatRoomParticipant;
import org.example.backend.model.Message;
import org.example.backend.model.User;
import org.example.backend.repository.ChatRoomParticipantRepository;
import org.example.backend.repository.ChatRoomRepository;
import org.example.backend.repository.MessageRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class ChatRoomService implements IChatRoomService {

    @Autowired
    ChatRoomRepository chatRoomRepo;

    @Autowired
    ChatRoomParticipantRepository participantRepo;

    @Autowired
    MessageRepository messageRepo;

    @Autowired
    UserRepository userRepo;

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

    // ──────────────────────────────────────────────
    // DM messaging methods
    // ──────────────────────────────────────────────

    @Override
    @Transactional
    public ChatRoom getOrCreateChatRoom(Integer currentUserId, Integer targetUserId) {
        // Prevent creating a room with yourself
        if (currentUserId.equals(targetUserId)) {
            throw new RuntimeException("Cannot create a chat room with yourself");
        }

        // Check if a room already exists between the two users
        Optional<ChatRoom> existingRoom = chatRoomRepo.findChatRoomBetweenUsers(currentUserId, targetUserId);

        if (existingRoom.isPresent()) {
            return existingRoom.get();
        }

        // Create new chat room
        User currentUser = userRepo.findById(currentUserId)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
        User targetUser = userRepo.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setName(currentUser.getUsername() + " & " + targetUser.getUsername());
        chatRoom.setCreatedAt(new Date());
        chatRoom = chatRoomRepo.save(chatRoom);

        // Create participant for current user
        ChatRoomParticipant participant1 = new ChatRoomParticipant();
        participant1.setUser(currentUser);
        participant1.setChatRoom(chatRoom);
        participant1.setLastSeenAt(new Date());
        participantRepo.save(participant1);

        // Create participant for target user
        ChatRoomParticipant participant2 = new ChatRoomParticipant();
        participant2.setUser(targetUser);
        participant2.setChatRoom(chatRoom);
        participant2.setLastSeenAt(new Date());
        participantRepo.save(participant2);

        return chatRoom;
    }

    @Override
    public List<ConversationResponse> getConversations(Integer userId) {
        User currentUser = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ChatRoomParticipant> myParticipations = participantRepo.findByUser(currentUser);
        List<ConversationResponse> conversations = new ArrayList<>();

        for (ChatRoomParticipant participation : myParticipations) {
            ChatRoom chatRoom = participation.getChatRoom();

            // Find the other participant
            List<ChatRoomParticipant> allParticipants = participantRepo.findByChatRoom(chatRoom);
            ChatRoomParticipant otherParticipant = allParticipants.stream()
                    .filter(p -> !p.getUser().getUserId().equals(userId))
                    .findFirst()
                    .orElse(null);

            if (otherParticipant == null) {
                continue; // Skip if no other participant found
            }

            User otherUser = otherParticipant.getUser();

            // Get last message
            Message lastMsg = messageRepo.findTopByChatRoomOrderBySentAtDesc(chatRoom);
            String lastMessageContent = lastMsg != null ? lastMsg.getContent() : null;
            Date lastMessageTime = lastMsg != null ? lastMsg.getSentAt() : chatRoom.getCreatedAt();

            // Calculate unread count
            long unreadCount = 0;
            Date lastSeenAt = participation.getLastSeenAt();
            if (lastSeenAt != null) {
                unreadCount = messageRepo.countByChatRoomAndSenderNotAndSentAtAfter(
                        chatRoom, currentUser, lastSeenAt);
            }

            conversations.add(new ConversationResponse(
                    chatRoom.getChatRoomId(),
                    otherUser.getUserId(),
                    otherUser.getUsername(),
                    otherUser.getProfileImageUrl(),
                    lastMessageContent,
                    lastMessageTime,
                    unreadCount
            ));
        }

        // Sort by lastMessageTime descending (most recent first)
        conversations.sort((a, b) -> {
            if (a.lastMessageTime() == null && b.lastMessageTime() == null) return 0;
            if (a.lastMessageTime() == null) return 1;
            if (b.lastMessageTime() == null) return -1;
            return b.lastMessageTime().compareTo(a.lastMessageTime());
        });

        return conversations;
    }

    @Override
    @Transactional
    public void markMessagesAsSeen(Integer chatRoomId, Integer userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        ChatRoom chatRoom = chatRoomRepo.findById(chatRoomId)
                .orElseThrow(() -> new RuntimeException("Chat room not found"));

        ChatRoomParticipant participant = participantRepo.findByUserAndChatRoom(user, chatRoom)
                .orElseThrow(() -> new RuntimeException("User is not a participant of this chat room"));

        participant.setLastSeenAt(new Date());
        participantRepo.save(participant);
    }

    @Override
    public boolean isUserInChatRoom(Integer chatRoomId, Integer userId) {
        User user = userRepo.findById(userId).orElse(null);
        ChatRoom chatRoom = chatRoomRepo.findById(chatRoomId).orElse(null);

        if (user == null || chatRoom == null) {
            return false;
        }

        return participantRepo.findByUserAndChatRoom(user, chatRoom).isPresent();
    }
}