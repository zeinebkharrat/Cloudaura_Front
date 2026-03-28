package org.example.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Public product row for the artisanat catalog (no sensitive user fields, safe with open-in-view=false).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductCatalogItem(
        Integer productId,
        String name,
        String imageUrl,
        Double price,
        Integer stock,
        CatalogSeller user
) {
    public record CatalogSeller(String username) {
    }
}
