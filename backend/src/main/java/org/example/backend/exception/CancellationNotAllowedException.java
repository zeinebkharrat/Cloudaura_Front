package org.example.backend.exception;

public class CancellationNotAllowedException extends RuntimeException {

    private final String catalogKey;

    public CancellationNotAllowedException(String catalogKey) {
        super(catalogKey);
        this.catalogKey = catalogKey;
    }

    public String getCatalogKey() {
        return catalogKey;
    }
}
