package org.example.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Reads legacy/free-text values in {@code restaurants.cuisine_type} (e.g. French labels with accents)
 * and persists canonical enum names ({@link CuisineType#name()}).
 */
@Converter(autoApply = false)
public class CuisineTypeConverter implements AttributeConverter<CuisineType, String> {

    @Override
    public String convertToDatabaseColumn(CuisineType attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public CuisineType convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        String trimmed = dbData.trim();
        try {
            return CuisineType.valueOf(trimmed);
        } catch (IllegalArgumentException ignored) {
            try {
                return CuisineType.fromValue(trimmed);
            } catch (IllegalArgumentException ex) {
                return CuisineType.INTERNATIONAL;
            }
        }
    }
}
