package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="order_items")
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderItemId;
    @ManyToOne @JoinColumn(name="order_id")
    private OrderEntity order;
    @ManyToOne @JoinColumn(name="product_id")
    private Product product;
    private Integer quantity;
}