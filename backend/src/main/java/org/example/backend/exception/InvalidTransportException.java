package org.example.backend.exception;

public class InvalidTransportException extends RuntimeException {
    private final String errorCode;

    public InvalidTransportException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
