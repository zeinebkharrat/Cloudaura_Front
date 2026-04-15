package org.example.backend.exception;

public class RoomNotAvailableException extends RuntimeException {

    private final String catalogKey;

    public RoomNotAvailableException(String catalogKey) {
        super(catalogKey);
        this.catalogKey = catalogKey;
    }

    public String getCatalogKey() {
        return catalogKey;
    }
}
