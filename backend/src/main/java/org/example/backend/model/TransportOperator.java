package org.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "transport_operators")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TransportOperator {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "operator_id")
    private Integer operatorId;

    @Column(nullable = false)
    private String name;

    @Column(name = "company_name")
    private String companyName;

    @Column(unique = true)
    private String email;

    private String phone;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
