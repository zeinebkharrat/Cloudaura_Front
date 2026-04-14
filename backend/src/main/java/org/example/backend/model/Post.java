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
    @Column(columnDefinition="TEXT")
    private String hashtags;
    private String location;
    private String visibility;
    @ManyToOne
    @JoinColumn(name = "repost_of_post_id")
    private Post repostOf;
    private Integer likesCount;
    private Integer commentsCount;
    private Integer totalViews;
    private Integer repostCount;
    private Double postScore;
    private Date createdAt;
    private Date updatedAt;
}