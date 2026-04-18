package org.example.backend.service.flight;

import org.example.backend.exception.InvalidInputException;

public class FlightValidationException extends InvalidInputException {

    private final String clientMessage;

    public FlightValidationException(String catalogKey, String clientMessage) {
        super(catalogKey, clientMessage);
        this.clientMessage = clientMessage;
    }

    public String getCatalogKey() {
        return super.getCatalogKey();
    }

    public String getClientMessage() {
        return clientMessage;
    }
}
