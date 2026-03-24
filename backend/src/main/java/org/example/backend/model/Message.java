package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="messages")
public class Message {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer messageId;
    @ManyToOne @JoinColumn(name="chat_room_id")
    private ChatRoom chatRoom;
    @ManyToOne @JoinColumn(name="sender_id")
    private User sender;
    @Lob @Column(columnDefinition="TEXT")
    private String content;
    private Date sentAt;
}