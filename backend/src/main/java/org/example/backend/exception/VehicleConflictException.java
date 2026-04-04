package org.example.backend.exception;

public class VehicleConflictException extends RuntimeException {
    public VehicleConflictException(String message) {
        super(message);
    }
}
