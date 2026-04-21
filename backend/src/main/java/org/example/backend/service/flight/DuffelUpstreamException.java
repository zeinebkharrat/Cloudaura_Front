package org.example.backend.service.flight;

import lombok.Getter;

@Getter
public class DuffelUpstreamException extends RuntimeException {

    private final int httpStatus;

    public DuffelUpstreamException(String message, int httpStatus) {
        super(message);
        this.httpStatus = httpStatus;
    }
}
