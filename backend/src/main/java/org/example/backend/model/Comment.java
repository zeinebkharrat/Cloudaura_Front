package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="comments")
public class Comment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer commentId;
    @ManyToOne @JoinColumn(name="post_id")
    private Post post;
    @ManyToOne @JoinColumn(name="author_id")
    private User author;
    @ManyToOne @JoinColumn(name="parent_id")
    private Comment parent;
    @Lob @Column(columnDefinition="TEXT")
    private String content;
    private Date createdAt;
    private Date updatedAt;
}