package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="roadmap_nodes")
public class RoadmapNode {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer nodeId;
    private Integer stepOrder;
    private String nodeLabel;
    @ManyToOne @JoinColumn(name="quiz_id")
    private Quiz quiz;
    @ManyToOne @JoinColumn(name="crossword_id")
    private Crossword crossword;
}