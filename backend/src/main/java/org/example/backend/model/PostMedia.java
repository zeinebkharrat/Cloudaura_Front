package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="post_media")
public class PostMedia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer mediaId;
    @ManyToOne @JoinColumn(name="post_id")
    private Post post;
    private String fileUrl;
    @Enumerated(EnumType.STRING)
    private MediaType mediaType;
    private Integer orderIndex;
}