package org.example.backend.exception;

import lombok.Getter;

@Getter
public class InvalidInputException extends IllegalArgumentException implements ExposableException {

    private final String catalogKey;

    public InvalidInputException(String message) {
        this("api.error.invalid_payload", message);
    }

    public InvalidInputException(String catalogKey, String message) {
        super(message);
        this.catalogKey = catalogKey;
    }
}
