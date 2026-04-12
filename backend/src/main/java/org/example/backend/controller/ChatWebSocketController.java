package org.example.backend.controller;

import org.example.backend.dto.MessageResponse;
import org.example.backend.dto.SendMessageRequest;
import org.example.backend.dto.TypingEvent;
import org.example.backend.model.User;
import org.example.backend.service.IChatRoomService;
import org.example.backend.service.IMessageService;
import org.example.backend.service.CustomUserDetailsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatWebSocketController {

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    @Autowired
    private IMessageService messageService;

    @Autowired
    private IChatRoomService chatRoomService;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @MessageMapping("/send-message")
    public void sendMessage(SendMessageRequest request, Principal principal) {
        User sender = extractUser(principal);

        // Verify the sender is a participant
        if (!chatRoomService.isUserInChatRoom(request.chatRoomId(), sender.getUserId())) {
            return; // Silently reject — user is not a participant
        }

        if (request.receiverId() == null
                || !chatRoomService.isUserInChatRoom(request.chatRoomId(), request.receiverId())) {
            return;
        }

        boolean hasEncryptedPayload = request.encryptedMessage() != null && !request.encryptedMessage().isBlank()
                && request.encryptedKey() != null && !request.encryptedKey().isBlank()
                && request.iv() != null && !request.iv().isBlank();
        if (!hasEncryptedPayload && (request.content() == null || request.content().isBlank())) {
            return;
        }

        // Save and broadcast
        MessageResponse response = messageService.sendMessage(
                request.chatRoomId(),
                sender.getUserId(),
                request.receiverId(),
                request.encryptedMessage(),
                request.encryptedKey(),
                request.iv(),
                request.content()
        );

        messagingTemplate.convertAndSend(
                "/topic/chat/" + request.chatRoomId(),
                response
        );
    }

    @MessageMapping("/typing")
    public void handleTyping(TypingEvent event, Principal principal) {
        User user = extractUser(principal);

        // Verify the user is a participant
        if (!chatRoomService.isUserInChatRoom(event.chatRoomId(), user.getUserId())) {
            return;
        }

        // Broadcast typing event with authenticated user info
        TypingEvent outgoing = new TypingEvent(
                event.chatRoomId(),
                user.getUserId(),
                user.getUsername(),
                event.typing()
        );

        messagingTemplate.convertAndSend(
                "/topic/chat/" + event.chatRoomId() + "/typing",
                outgoing
        );
    }

    private User extractUser(Principal principal) {
        if (principal instanceof Authentication authentication
                && authentication.getPrincipal() instanceof CustomUserDetailsService.CustomUserDetails) {
            return ((CustomUserDetailsService.CustomUserDetails) authentication.getPrincipal()).getUser();
        }

        if (principal instanceof Authentication authentication && authentication.getName() != null) {
            var details = (CustomUserDetailsService.CustomUserDetails) customUserDetailsService
                    .loadUserByUsername(authentication.getName());
            return details.getUser();
        }

        if (principal != null && principal.getName() != null && !principal.getName().isBlank()) {
            var details = (CustomUserDetailsService.CustomUserDetails) customUserDetailsService
                    .loadUserByUsername(principal.getName());
            return details.getUser();
        }

        throw new RuntimeException("User not authenticated");
    }
}
