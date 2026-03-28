package org.example.backend.controller;

import org.example.backend.dto.ConversationResponse;
import org.example.backend.dto.MessageResponse;
import org.example.backend.model.ChatRoom;
import org.example.backend.model.User;
import org.example.backend.repository.UserRepository;
import org.example.backend.service.IChatRoomService;
import org.example.backend.service.IMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/chatroom")
public class ChatRoomController {

    @Autowired
    IChatRoomService chatRoomService;

    @Autowired
    IMessageService messageService;

    @Autowired
    UserRepository userRepository;

    // ──────────────────────────────────────────────
    // Legacy CRUD endpoints (kept for backward compatibility)
    // ──────────────────────────────────────────────

    @GetMapping("/all")
    public List<ChatRoom> getAllChatRooms() {
        return chatRoomService.retrieveAllChatRooms();
    }

    @PostMapping("/add")
    public ChatRoom addChatRoom(@RequestBody ChatRoom chatRoom) {
        return chatRoomService.addChatRoom(chatRoom);
    }

    @PutMapping("/update")
    public ChatRoom updateChatRoom(@RequestBody ChatRoom chatRoom) {
        return chatRoomService.updateChatRoom(chatRoom);
    }

    @GetMapping("/{id}")
    public ChatRoom getChatRoom(@PathVariable Integer id) {
        return chatRoomService.retrieveChatRoom(id);
    }

    @DeleteMapping("/delete/{id}")
    public void deleteChatRoom(@PathVariable Integer id) {
        chatRoomService.removeChatRoom(id);
    }

    // Custom endpoint
    @PostMapping("/createIfNotExists/{name}")
    public ResponseEntity<ChatRoom> createRoomIfNotExists(@PathVariable String name) {
        return ResponseEntity.ok(chatRoomService.createRoomIfNotExists(name));
    }

    // ──────────────────────────────────────────────
    // DM messaging endpoints (JWT-authenticated)
    // ──────────────────────────────────────────────

    @PostMapping("/dm/{targetUserId}")
    public ResponseEntity<Map<String, Object>> getOrCreateDmRoom(@PathVariable Integer targetUserId) {
        User currentUser = getCurrentUser();

        try {
            ChatRoom chatRoom = chatRoomService.getOrCreateChatRoom(currentUser.getUserId(), targetUserId);

            Map<String, Object> response = new HashMap<>();
            response.put("chatRoomId", chatRoom.getChatRoomId());
            response.put("name", chatRoom.getName());
            response.put("createdAt", chatRoom.getCreatedAt());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping("/my")
    public ResponseEntity<List<ConversationResponse>> getMyConversations() {
        User currentUser = getCurrentUser();
        List<ConversationResponse> conversations = chatRoomService.getConversations(currentUser.getUserId());
        return ResponseEntity.ok(conversations);
    }

    @PostMapping("/{chatRoomId}/seen")
    public ResponseEntity<Map<String, String>> markAsSeen(@PathVariable Integer chatRoomId) {
        User currentUser = getCurrentUser();

        if (!chatRoomService.isUserInChatRoom(chatRoomId, currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant of this chat room");
        }

        chatRoomService.markMessagesAsSeen(chatRoomId, currentUser.getUserId());

        Map<String, String> response = new HashMap<>();
        response.put("message", "Messages marked as seen");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{chatRoomId}/messages")
    public ResponseEntity<List<MessageResponse>> getChatRoomMessages(@PathVariable Integer chatRoomId) {
        User currentUser = getCurrentUser();

        if (!chatRoomService.isUserInChatRoom(chatRoomId, currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant of this chat room");
        }

        List<MessageResponse> messages = messageService.getMessagesByChatRoomOrdered(chatRoomId);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/users/search")
    public ResponseEntity<List<Map<String, Object>>> searchUsers(@RequestParam String q) {
        User currentUser = getCurrentUser();

        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.ok(List.of());
        }

        List<Map<String, Object>> results = userRepository.searchByTerm(q.trim()).stream()
                .filter(u -> !u.getUserId().equals(currentUser.getUserId()))
                .limit(20)
                .map(u -> {
                    Map<String, Object> dto = new HashMap<>();
                    dto.put("userId", u.getUserId());
                    dto.put("username", u.getUsername());
                    dto.put("firstName", u.getFirstName());
                    dto.put("lastName", u.getLastName());
                    dto.put("profileImageUrl", u.getProfileImageUrl());
                    return dto;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(results);
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof org.example.backend.service.CustomUserDetailsService.CustomUserDetails) {
            return ((org.example.backend.service.CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication principal");
    }
}