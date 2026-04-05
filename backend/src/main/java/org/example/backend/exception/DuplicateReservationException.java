package org.example.backend.exception;
public class DuplicateReservationException extends RuntimeException {
    public DuplicateReservationException(String message) { super(message); }
}
