package org.example.backend.repository;

import org.example.backend.model.ChatRoom;
import org.example.backend.model.ChatRoomParticipant;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomParticipantRepository extends JpaRepository<ChatRoomParticipant, Integer> {
    List<ChatRoomParticipant> findByUser(User user);
    Optional<ChatRoomParticipant> findByUserAndChatRoom(User user, ChatRoom chatRoom);
    List<ChatRoomParticipant> findByChatRoom(ChatRoom chatRoom);
}
