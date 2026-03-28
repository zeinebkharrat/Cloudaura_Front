package org.example.backend.repository;

import org.example.backend.model.ChatRoom;
import org.example.backend.model.Message;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Integer> {
    List<Message> findByChatRoom(ChatRoom chatRoom);
    List<Message> findBySender(User sender);
    List<Message> findByChatRoomOrderBySentAtAsc(ChatRoom chatRoom);
    Message findTopByChatRoomOrderBySentAtDesc(ChatRoom chatRoom);
    long countByChatRoomAndSenderNotAndSentAtAfter(ChatRoom chatRoom, User sender, Date after);
}