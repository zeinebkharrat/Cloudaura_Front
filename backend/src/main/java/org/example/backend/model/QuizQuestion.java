package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="quiz_questions")
public class QuizQuestion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer questionId;
    @ManyToOne @JoinColumn(name="quiz_id")
    private Quiz quiz;
    private Integer orderIndex;
    private String questionText;
    private String imageUrl;
    @Lob @Column(columnDefinition="TEXT")
    private String optionsJson;
    private Integer correctOptionIndex;
}