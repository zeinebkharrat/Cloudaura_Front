package org.example.backend.service.flight;

import lombok.Getter;

/**
 * Thrown when Aviationstack returns an error or the HTTP client fails.
 */
@Getter
public class AviationStackUpstreamException extends RuntimeException {

    private final int httpStatus;

    public AviationStackUpstreamException(String message, int httpStatus) {
        super(message);
        this.httpStatus = httpStatus;
    }
}
