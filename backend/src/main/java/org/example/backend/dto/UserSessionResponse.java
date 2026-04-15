package org.example.backend.dto;

import java.util.Date;

public record UserSessionResponse(
        String sessionId,
        boolean current,
        Date issuedAt,
        Date lastSeenAt,
        String userAgent,
        String ipAddress
) {
}
