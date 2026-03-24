package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="user_preferences")
public class UserPreference {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer preferenceId;
    @OneToOne @JoinColumn(name="user_id")
    private User user;
    private Double budgetMin;
    private Double budgetMax;
    private String travelStyle;
    private String preferredRegion;
    private String preferredCuisine;
    private String transportPreference;
    private String accommodationType;
    private String travelWith;
}