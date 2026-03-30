package org.example.backend.dto;

import org.example.backend.dto.UserSummaryResponse;

public class AuthResponse {
    private final String token;
    private final long expiresIn;
    private final UserSummaryResponse user;

    public AuthResponse(String token, long expiresIn, UserSummaryResponse user) {
        this.token = token;
        this.expiresIn = expiresIn;
        this.user = user;
    }

    public String getToken() { return token; }
    public long getExpiresIn() { return expiresIn; }
    public UserSummaryResponse getUser() { return user; }
}
