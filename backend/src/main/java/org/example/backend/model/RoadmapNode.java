package org.example.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "roadmap_nodes")
public class RoadmapNode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer nodeId;
    private Integer stepOrder;
    private String nodeLabel;
    @ManyToOne
    @JoinColumn(name = "quiz_id")
    private Quiz quiz;
    @ManyToOne
    @JoinColumn(name = "crossword_id")
    private Crossword crossword;
    @Column(name = "puzzle_id")
    private Integer puzzleId;

    public Integer getNodeId() {
        return nodeId;
    }

    public void setNodeId(Integer nodeId) {
        this.nodeId = nodeId;
    }

    public Integer getStepOrder() {
        return stepOrder;
    }

    public void setStepOrder(Integer stepOrder) {
        this.stepOrder = stepOrder;
    }

    public String getNodeLabel() {
        return nodeLabel;
    }

    public void setNodeLabel(String nodeLabel) {
        this.nodeLabel = nodeLabel;
    }

    public Quiz getQuiz() {
        return quiz;
    }

    public void setQuiz(Quiz quiz) {
        this.quiz = quiz;
    }

    public Crossword getCrossword() {
        return crossword;
    }

    public void setCrossword(Crossword crossword) {
        this.crossword = crossword;
    }

    public Integer getPuzzleId() {
        return puzzleId;
    }

    public void setPuzzleId(Integer puzzleId) {
        this.puzzleId = puzzleId;
    }
}
