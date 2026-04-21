package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "cooking_ingredients")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CookingIngredient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String iconUrl;
    
    private double x; // Default placement X %
    private double y; // Default placement Y %
}
