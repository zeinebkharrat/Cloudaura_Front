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

@Controller
public class ChatWebSocketController {

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    @Autowired
    private IMessageService messageService;

    @Autowired
    private IChatRoomService chatRoomService;

    @MessageMapping("/send-message")
    public void sendMessage(SendMessageRequest request, Authentication authentication) {
        User sender = extractUser(authentication);

        // Verify the sender is a participant
        if (!chatRoomService.isUserInChatRoom(request.chatRoomId(), sender.getUserId())) {
            return; // Silently reject — user is not a participant
        }

        // Save and broadcast
        MessageResponse response = messageService.sendMessage(
                request.chatRoomId(),
                sender.getUserId(),
                request.content()
        );

        messagingTemplate.convertAndSend(
                "/topic/chat/" + request.chatRoomId(),
                response
        );
    }

    @MessageMapping("/typing")
    public void handleTyping(TypingEvent event, Authentication authentication) {
        User user = extractUser(authentication);

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

    private User extractUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetailsService.CustomUserDetails) {
            return ((CustomUserDetailsService.CustomUserDetails) authentication.getPrincipal()).getUser();
        }
        throw new RuntimeException("User not authenticated");
    }
}
