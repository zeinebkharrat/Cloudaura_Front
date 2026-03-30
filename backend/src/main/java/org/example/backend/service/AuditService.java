package org.example.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.dto.AuditLogResponse;
import org.example.backend.model.AuditLog;
import org.example.backend.model.User;
import org.example.backend.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.Map;

@Service
public class AuditService {

    public static final String ACTION_BAN_USER = "BAN_USER";
    public static final String ACTION_UNBAN_USER = "UNBAN_USER";
    public static final String ACTION_EMAIL_CHANGE_SELF = "EMAIL_CHANGE_SELF";
    public static final String ACTION_EMAIL_CHANGE_ADMIN = "EMAIL_CHANGE_ADMIN";
    public static final String ACTION_PASSWORD_CHANGE = "PASSWORD_CHANGE";
    public static final String ACTION_PASSWORD_RESET = "PASSWORD_RESET";

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void log(String action, User targetUser, Map<String, Object> details) {
        AuditLog log = new AuditLog();
        log.setAction(action);
        log.setActor(resolveActor());
        log.setTargetUserId(targetUser != null ? targetUser.getUserId() : null);
        log.setTargetUserEmail(targetUser != null ? targetUser.getEmail() : null);
        log.setIpAddress(RequestAuditContext.ipAddress());
        log.setUserAgent(RequestAuditContext.userAgent());
        log.setDetails(serializeDetails(details));
        log.setCreatedAt(new Date());
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> list(String q,
                                       String action,
                                       Date from,
                                       Date to,
                                       Pageable pageable) {
        Specification<AuditLog> spec = (root, query, cb) -> cb.conjunction();

        if (q != null && !q.isBlank()) {
            String term = "%" + q.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("actor")), term),
                    cb.like(cb.lower(root.get("targetUserEmail")), term),
                    cb.like(cb.lower(root.get("ipAddress")), term),
                    cb.like(cb.lower(root.get("userAgent")), term),
                    cb.like(cb.lower(root.get("details")), term)
            ));
        }

        if (action != null && !action.isBlank()) {
            String normalizedAction = action.trim().toUpperCase();
            spec = spec.and((root, query, cb) -> cb.equal(root.get("action"), normalizedAction));
        }

        if (from != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }

        if (to != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }

        return auditLogRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public java.util.List<AuditLogResponse> listForExport(String q,
                                                          String action,
                                                          Date from,
                                                          Date to) {
        org.springframework.data.domain.Sort sort = org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt");
        Specification<AuditLog> spec = (root, query, cb) -> cb.conjunction();

        if (q != null && !q.isBlank()) {
            String term = "%" + q.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("actor")), term),
                    cb.like(cb.lower(root.get("targetUserEmail")), term),
                    cb.like(cb.lower(root.get("ipAddress")), term),
                    cb.like(cb.lower(root.get("userAgent")), term),
                    cb.like(cb.lower(root.get("details")), term)
            ));
        }

        if (action != null && !action.isBlank()) {
            String normalizedAction = action.trim().toUpperCase();
            spec = spec.and((root, query, cb) -> cb.equal(root.get("action"), normalizedAction));
        }

        if (from != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }

        if (to != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }

        return auditLogRepository.findAll(spec, sort).stream().map(this::toResponse).toList();
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getAction(),
                log.getActor(),
                log.getTargetUserId(),
                log.getTargetUserEmail(),
                log.getIpAddress(),
                log.getUserAgent(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }

    private String resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return "anonymous";
        }
        return authentication.getName();
    }

    private String serializeDetails(Map<String, Object> details) {
        if (details == null || details.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException ex) {
            return "{\"serializationError\":true}";
        }
    }
}
