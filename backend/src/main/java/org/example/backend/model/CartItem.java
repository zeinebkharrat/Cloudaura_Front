package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="cart_items")
public class CartItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cartItemId;
    @ManyToOne @JoinColumn(name="cart_id")
    private Cart cart;
    @ManyToOne @JoinColumn(name="product_id")
    private Product product;
    private Integer quantity;
}