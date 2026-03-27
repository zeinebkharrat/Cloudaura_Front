package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="activities")
public class Activity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer activityId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String name;
    private String type;
    private Double price;
    @Lob @Column(columnDefinition="TEXT")
    private String description;
    private String address;
    private Double latitude;
    private Double longitude;
}