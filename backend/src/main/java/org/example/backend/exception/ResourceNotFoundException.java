package org.example.backend.exception;

/** Thrown when a resource is missing; {@link #getCatalogKey()} is resolved for the API client. */
public class ResourceNotFoundException extends RuntimeException {

    private final String catalogKey;

    public ResourceNotFoundException(String catalogKey) {
        super(catalogKey);
        this.catalogKey = catalogKey;
    }

    public String getCatalogKey() {
        return catalogKey;
    }
}
