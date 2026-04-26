package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "point_packages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PointPackage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;        // e.g. "100 Points"
    private int pointsAmount;   // e.g. 100
    private double price;       // e.g. 5.99
    
    // Optional: flag to hide or show
    private boolean active = true;
}
