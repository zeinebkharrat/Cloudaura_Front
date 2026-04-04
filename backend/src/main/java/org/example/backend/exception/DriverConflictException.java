package org.example.backend.exception;

public class DriverConflictException extends RuntimeException {
    public DriverConflictException(String message) {
        super(message);
    }
}
