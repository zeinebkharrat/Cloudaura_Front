package org.example.backend.exception;

public class NoSeatsAvailableException extends RuntimeException {

    private final String catalogKey;

    public NoSeatsAvailableException(String catalogKey) {
        super(catalogKey);
        this.catalogKey = catalogKey;
    }

    public String getCatalogKey() {
        return catalogKey;
    }
}
