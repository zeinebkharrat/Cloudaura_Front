package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="products")
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer productId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private String name;
    private Double price;
    private Integer stock;
}