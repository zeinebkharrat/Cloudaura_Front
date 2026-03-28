package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="posts")
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer postId;
    @ManyToOne @JoinColumn(name="author_id")
    private User author;
    // Using plain TEXT instead of @Lob to avoid MySQL/Hibernate LOB binding issues
    // (your API accepts null content but fails for non-null content).
    @Column(columnDefinition="TEXT")
    private String content;
    private String location;
    private String visibility;
    private Integer likesCount;
    private Integer commentsCount;
    private Date createdAt;
    private Date updatedAt;
}