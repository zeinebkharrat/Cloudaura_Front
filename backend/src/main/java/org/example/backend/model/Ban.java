package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="bans")
public class Ban {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer banId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private String reason;
    private Date createdAt;
    private Date expiresAt;
    private Boolean isActive;
}
