package org.example.backend.repository;

import org.example.backend.model.ChatRoom;
import org.example.backend.model.Message;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Integer> {
    List<Message> findByChatRoom(ChatRoom chatRoom);
    List<Message> findBySender(User sender);
    List<Message> findByChatRoomOrderBySentAtAsc(ChatRoom chatRoom);

    @Query("""
            SELECT m FROM Message m
            JOIN FETCH m.chatRoom cr
            LEFT JOIN FETCH m.sender s
            WHERE cr.chatRoomId = :chatRoomId
            ORDER BY m.sentAt ASC
            """)
    List<Message> findByChatRoomIdOrderBySentAtAscWithRelations(@Param("chatRoomId") Integer chatRoomId);

    Optional<Message> findByMessageIdAndChatRoomChatRoomId(Integer messageId, Integer chatRoomId);

    @Modifying
    @Transactional
    @Query("DELETE FROM Message m WHERE m.sentAt < :cutoff")
    int deleteAllOlderThan(@Param("cutoff") Date cutoff);

    Message findTopByChatRoomOrderBySentAtDesc(ChatRoom chatRoom);
    long countByChatRoomAndSenderNotAndSentAtAfter(ChatRoom chatRoom, User sender, Date after);
}
