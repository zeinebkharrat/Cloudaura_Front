package org.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "transport_advisory_calendar",
    indexes = {
        @Index(name = "idx_advisory_type_date", columnList = "transport_type,start_date,end_date,is_active")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportAdvisoryCalendar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "advisory_id")
    private Integer advisoryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "transport_type", nullable = false, length = 20)
    private Transport.TransportType transportType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "demand_level", nullable = false, length = 20)
    @Builder.Default
    private DemandLevel demandLevel = DemandLevel.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(name = "availability_level", nullable = false, length = 20)
    @Builder.Default
    private AvailabilityLevel availabilityLevel = AvailabilityLevel.NORMAL;

    @Column(name = "price_multiplier_min", nullable = false, precision = 6, scale = 3)
    @Builder.Default
    private BigDecimal priceMultiplierMin = new BigDecimal("1.000");

    @Column(name = "price_multiplier_max", nullable = false, precision = 6, scale = 3)
    @Builder.Default
    private BigDecimal priceMultiplierMax = new BigDecimal("1.000");

    @Column(name = "advisory_message", length = 500)
    private String advisoryMessage;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    @Builder.Default
    private Source source = Source.MANUAL;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum DemandLevel {
        LOW,
        MEDIUM,
        HIGH,
        PEAK
    }

    public enum AvailabilityLevel {
        NORMAL,
        LIMITED,
        VERY_LIMITED
    }

    public enum Source {
        MANUAL,
        API_SYNC
    }
}
