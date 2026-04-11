package org.example.backend.service;

import org.springframework.stereotype.Service;

@Service
public class UserSessionService {

    public boolean isSessionActive(String sessionId, String username) {
        return sessionId != null && !sessionId.isBlank() && username != null && !username.isBlank();
    }

    public void touchSession(String sessionId) {
        // Session persistence is not enabled in this build; keep token-based auth flow compatible.
    }
}
