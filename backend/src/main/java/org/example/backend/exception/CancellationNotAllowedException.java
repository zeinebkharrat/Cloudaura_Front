package org.example.backend.exception;
public class CancellationNotAllowedException extends RuntimeException {
    public CancellationNotAllowedException(String message) { super(message); }
}
