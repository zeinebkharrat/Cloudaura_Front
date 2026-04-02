package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="order_items")
public class OrderItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderItemId;
    @ManyToOne @JoinColumn(name="order_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private OrderEntity order;
    @ManyToOne @JoinColumn(name="product_id")
    private Product product;
    @ManyToOne @JoinColumn(name="variant_id")
    private ProductVariant variant;
    private Integer quantity;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", columnDefinition = "VARCHAR(20)")
    private OrderStatus status;
}
