package org.example.backend.repository;

import org.example.backend.model.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Integer> {
    Optional<ChatRoom> findByName(String name);

    @Query("""
            SELECT cr FROM ChatRoom cr
            WHERE cr.chatRoomId IN (
                SELECT p1.chatRoom.chatRoomId FROM ChatRoomParticipant p1
                WHERE p1.user.userId = :userId1
            )
            AND cr.chatRoomId IN (
                SELECT p2.chatRoom.chatRoomId FROM ChatRoomParticipant p2
                WHERE p2.user.userId = :userId2
            )
            """)
    Optional<ChatRoom> findChatRoomBetweenUsers(@Param("userId1") Integer userId1,
                                                 @Param("userId2") Integer userId2);
}