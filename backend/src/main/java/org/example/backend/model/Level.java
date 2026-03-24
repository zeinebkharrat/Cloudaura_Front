package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="levels")
public class Level {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer levelId;
    private String name;
    private Integer minPoints;
    private Integer maxPoints;
}