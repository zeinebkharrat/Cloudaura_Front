package org.example.backend.controller;

import org.example.backend.model.ChatRoom;
import org.example.backend.service.IChatRoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/chatroom")
public class ChatRoomController {

    @Autowired
    IChatRoomService chatRoomService;

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
}