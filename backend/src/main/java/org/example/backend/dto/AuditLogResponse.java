package org.example.backend.dto;

import java.util.Date;

public record AuditLogResponse(
        Long id,
        String action,
        String actor,
        Integer targetUserId,
        String targetUserEmail,
        String ipAddress,
        String userAgent,
        String details,
        Date createdAt
) {
}
