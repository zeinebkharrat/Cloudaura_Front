package org.example.backend.exception;

public class DuplicateReservationException extends RuntimeException {

    private final String catalogKey;

    public DuplicateReservationException(String catalogKey) {
        super(catalogKey);
        this.catalogKey = catalogKey;
    }

    public String getCatalogKey() {
        return catalogKey;
    }
}
