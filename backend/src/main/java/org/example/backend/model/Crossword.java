package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="crosswords")
public class Crossword {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer crosswordId;
    private String title;
    private String description;
    private Boolean published;
    private Date createdAt;
    @Lob @Column(columnDefinition="TEXT")
    private String gridJson;
}