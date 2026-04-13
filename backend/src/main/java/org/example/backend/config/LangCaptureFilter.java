package org.example.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.example.backend.i18n.ApiRequestLang;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Captures {@code lang} query parameter (or default fr) for the request so services can call
 * {@link org.example.backend.service.CatalogTranslationService#resolveForRequest} without every controller declaring {@code lang}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class LangCaptureFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) {
            return true;
        }
        return uri.startsWith("/api/translate") || !uri.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String uri = request.getRequestURI();
            if (isBackOfficeCatalogSourceUri(uri)) {
                ApiRequestLang.setCatalogResolutionDisabled(true);
            }
            String lang = request.getParameter("lang");
            if (lang == null || lang.isBlank()) {
                String acceptLang = request.getHeader("Accept-Language");
                if (acceptLang != null && !acceptLang.isBlank()) {
                    lang = acceptLang.split("[,;]")[0].trim();
                }
            }
            ApiRequestLang.setFromRaw(lang);
            filterChain.doFilter(request, response);
        } finally {
            ApiRequestLang.clear();
        }
    }

    /**
     * Admin UIs must load entity fields as stored in JPA (French/source), not merged with {@code translations}.
     */
    private static boolean isBackOfficeCatalogSourceUri(String uri) {
        if (uri == null) {
            return false;
        }
        return uri.startsWith("/api/admin/")
                || "/api/admin".equals(uri)
                || uri.startsWith("/api/events/admin/");
    }
}
