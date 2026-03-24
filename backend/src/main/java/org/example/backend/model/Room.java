package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="rooms")
public class Room {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer roomId;
    @ManyToOne @JoinColumn(name="accommodation_id")
    private Accommodation accommodation;
    private String roomType;
    private Double price;
    private Integer capacity;
}