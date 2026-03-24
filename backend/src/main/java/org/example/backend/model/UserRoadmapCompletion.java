package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="user_roadmap_completions")
public class UserRoadmapCompletion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer completionId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    @ManyToOne @JoinColumn(name="node_id")
    private RoadmapNode roadmapNode;
    private Date completedAt;
    private Integer score;
    private Integer maxScore;
}