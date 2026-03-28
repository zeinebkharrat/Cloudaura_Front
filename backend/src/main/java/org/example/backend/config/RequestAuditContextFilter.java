package org.example.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.example.backend.service.RequestAuditContext;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class RequestAuditContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String forwarded = request.getHeader("X-Forwarded-For");
        String ipAddress = resolveIpAddress(forwarded, request.getRemoteAddr());
        String userAgent = request.getHeader("User-Agent");
        RequestAuditContext.set(ipAddress, userAgent);
        try {
            filterChain.doFilter(request, response);
        } finally {
            RequestAuditContext.clear();
        }
    }

    private String resolveIpAddress(String forwardedFor, String remoteAddr) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return remoteAddr;
        }
        String[] parts = forwardedFor.split(",");
        if (parts.length == 0) {
            return remoteAddr;
        }
        return parts[0].trim();
    }
}
