package com.yallatn.exception;
public class CancellationNotAllowedException extends RuntimeException {
    public CancellationNotAllowedException(String message) { super(message); }
}
