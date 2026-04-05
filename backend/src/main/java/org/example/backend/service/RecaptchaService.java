package org.example.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

@Service
@Slf4j
public class RecaptchaService {

    private static final String VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

    private final RestTemplate restTemplate;

    @Value("${app.recaptcha.secret:}")
    private String secretKey;

    @Value("${app.recaptcha.site-key:}")
    private String siteKey;

    public RecaptchaService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean hasSecret() {
        return secretKey != null && !secretKey.isBlank();
    }

    public boolean hasSiteKey() {
        return siteKey != null && !siteKey.trim().isEmpty();
    }

    /**
     * Captcha is enforced only when both keys are set (same rule as {@code /api/auth/captcha-config}).
     */
    public boolean isEnabled() {
        return hasSecret() && hasSiteKey();
    }

    /**
     * When reCAPTCHA is not fully configured or has no secret, always returns true.
     */
    @SuppressWarnings("unchecked")
    public boolean verifyResponse(String userResponseToken) {
        if (!hasSecret()) {
            return true;
        }
        if (!hasSiteKey()) {
            log.warn("reCAPTCHA secret is set but site key is blank — skipping Google verify");
            return true;
        }
        if (userResponseToken == null || userResponseToken.isBlank()) {
            return false;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("secret", secretKey.trim());
            body.add("response", userResponseToken.trim());
            String remoteIp = resolveClientIp();
            if (remoteIp != null && !remoteIp.isBlank()) {
                body.add("remoteip", remoteIp);
            }
            Map<String, Object> response = restTemplate.postForObject(
                    VERIFY_URL,
                    new HttpEntity<>(body, headers),
                    Map.class
            );
            boolean ok = response != null && Boolean.TRUE.equals(response.get("success"));
            if (!ok) {
                log.warn("reCAPTCHA verification failed. success={}, error-codes={}, hostname={}",
                        response != null ? response.get("success") : null,
                        response != null ? response.get("error-codes") : null,
                        response != null ? response.get("hostname") : null);
            }
            return ok;
        } catch (Exception ex) {
            log.error("reCAPTCHA verify request failed", ex);
            return false;
        }
    }

    private static String resolveClientIp() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) {
                return null;
            }
            HttpServletRequest req = attrs.getRequest();
            String xf = req.getHeader("X-Forwarded-For");
            if (xf != null && !xf.isBlank()) {
                return xf.split(",")[0].trim();
            }
            return req.getRemoteAddr();
        } catch (Exception e) {
            return null;
        }
    }
}
