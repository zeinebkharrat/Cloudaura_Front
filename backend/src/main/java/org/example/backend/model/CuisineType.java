package org.example.backend.model;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;

public enum CuisineType {
    TUNISIAN("Tunisian"),
    MEDITERRANEAN("Mediterranean"),
    SEAFOOD("Seafood"),
    STREET_FOOD("Street Food"),
    TRADITIONAL("Traditional"),
    HEALTHY("Healthy"),
    MIXED("Mixed"),
    ITALIAN("Italian"),
    FRENCH("French"),
    ASIAN("Asian"),
    FAST_FOOD("Fast Food"),
    CAFE("Cafe"),
    VEGETARIAN("Vegetarian"),
    SWEET("Sweet"),
    INTERNATIONAL("International");

    private final String label;

    CuisineType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static CuisineType fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String normalized = normalize(raw);
        switch (normalized) {
            case "tunisienne" -> {
                return TUNISIAN;
            }
            case "mediterraneenne" -> {
                return MEDITERRANEAN;
            }
            case "italienne" -> {
                return ITALIAN;
            }
            case "francaise", "française" -> {
                return FRENCH;
            }
            case "asiatique" -> {
                return ASIAN;
            }
            case "vegetarienne", "vegetarien", "végétarienne", "végétarien" -> {
                return VEGETARIAN;
            }
            case "cafe", "café" -> {
                return CAFE;
            }
            case "streetfood" -> {
                return STREET_FOOD;
            }
            case "sucre", "sweet", "dessert", "patisserie", "pâtisserie", "gateau", "gâteau" -> {
                return SWEET;
            }
            default -> {
            }
        }

        return Arrays.stream(values())
                .filter(value -> normalize(value.name()).equals(normalized) || normalize(value.label).equals(normalized))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Type de cuisine invalide: " + raw));
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String folded =
                Normalizer.normalize(value.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return folded.toLowerCase(Locale.ROOT).replace("-", " ").replace("_", " ").replaceAll("\\s+", " ");
    }
}