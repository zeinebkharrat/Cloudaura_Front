package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="orders")
public class OrderEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderId;
    @ManyToOne @JoinColumn(name="user_id")
    private User user;
    private Double totalAmount;
    @Enumerated(EnumType.STRING)
    private OrderStatus status;
}