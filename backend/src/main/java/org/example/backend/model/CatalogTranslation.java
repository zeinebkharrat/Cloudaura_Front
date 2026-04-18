package org.example.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "translations",
        uniqueConstraints = @UniqueConstraint(columnNames = {"translation_key", "lang"})
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CatalogTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "translation_key", nullable = false, length = 500)
    private String translationKey;

    @Column(nullable = false, length = 8)
    private String lang;

    @Column(name = "translation_text", nullable = false, columnDefinition = "TEXT")
    private String value;

    /**
     * Legacy schema compatibility: some DBs still enforce NOT NULL on `value`.
     */
    @Column(name = "value", nullable = false, columnDefinition = "TEXT")
    private String legacyValue;

    @PrePersist
    @PreUpdate
    void syncLegacyColumns() {
        if (value == null) {
            value = "";
        }
        legacyValue = value;
    }
}
