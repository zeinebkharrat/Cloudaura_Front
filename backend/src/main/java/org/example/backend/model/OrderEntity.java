package org.example.backend.model;

import jakarta.persistence.*;
import java.util.Date;
import lombok.Data;

@Data
@Entity
@Table(name = "orders")
public class OrderEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderId;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private Double totalAmount;
    
    /** Frais de livraison fixe de 7 TND. */
    private Double deliveryFee;

    /** Adresse complète saisie lors de la commande. */
    private String deliveryAddress;

    /** Mode de paiement : "CARD" (carte bancaire) ou "COD" (à la livraison). */
    private String paymentMethod;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    /** Date de création de la commande (checkout). */
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;
}