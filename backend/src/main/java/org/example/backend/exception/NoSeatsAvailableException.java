package org.example.backend.exception;
public class NoSeatsAvailableException extends RuntimeException {
    public NoSeatsAvailableException(String message) { super(message); }
}
