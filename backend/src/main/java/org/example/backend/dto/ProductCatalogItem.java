package org.example.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Public product row for the artisanat catalog (no sensitive user fields, safe with open-in-view=false).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductCatalogItem(
        Integer productId,
        String name,
        String description,
        String category,
        String status,
        String imageUrl,
        Double price,
        Integer stock,
        CatalogSeller user,
        List<CatalogImage> images,
        List<CatalogVariant> variants,
        Boolean isFavorite
) {
    public record CatalogSeller(String username, String cityName) {}
    public record CatalogImage(Integer id, String url) {}
    /** Named variantId in JSON so Angular matches {@code variantId} on catalog lines. */
    public record CatalogVariant(Integer variantId, String size, String color, Integer stock, Double priceOverride) {}
}
