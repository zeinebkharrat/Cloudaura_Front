package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "promo_codes")
public class PromoCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer promoId;

    @Column(unique = true, nullable = false)
    private String code;

    private Double discountPercent;
    private Double discountAmount;
    
    private Date expiryDate;
    private boolean active = true;
}
