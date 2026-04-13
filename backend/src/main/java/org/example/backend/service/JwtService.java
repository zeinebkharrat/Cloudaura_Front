package org.example.backend.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${jwt.secret:change-me-use-at-least-64-chars-for-production-security-key-0123456789abcdef}")
    private String secret;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    private static final int MIN_HMAC_KEY_BYTES = 32; // HS256 requires >= 256 bits (JJWT)

    private SecretKey signingKey;

    @PostConstruct
    public void init() {
        String trimmed = secret == null ? "" : secret.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalStateException("jwt.secret must not be empty (set jwt.secret or JWT_SECRET).");
        }
        byte[] keyBytes = resolveHmacKeyBytes(trimmed);
        if (keyBytes.length < MIN_HMAC_KEY_BYTES) {
            throw new IllegalStateException(
                    "jwt.secret must be at least "
                            + MIN_HMAC_KEY_BYTES
                            + " bytes for HS256. After resolving (Base64 or UTF-8), length is "
                            + keyBytes.length
                            + ". Use a longer plain secret or a Base64 value that decodes to at least "
                            + MIN_HMAC_KEY_BYTES
                            + " bytes.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * If the value is valid Base64 and decodes to a long enough key, use decoded bytes; otherwise use UTF-8
     * of the string. This avoids startup failure when someone sets a short secret that happens to be valid
     * Base64 (decoded length under 32), which previously made {@link Keys#hmacShaKeyFor(byte[])} throw.
     */
    private static byte[] resolveHmacKeyBytes(String trimmed) {
        try {
            byte[] decoded = Decoders.BASE64.decode(trimmed);
            if (decoded.length >= MIN_HMAC_KEY_BYTES) {
                return decoded;
            }
        } catch (Exception ignored) {
            // Not Base64 — use UTF-8 below
        }
        return trimmed.getBytes(StandardCharsets.UTF_8);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(userDetails, null);
    }

    public String generateToken(UserDetails userDetails, String sessionId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        var builder = Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiryDate)
            .signWith(signingKey);

        if (sessionId != null && !sessionId.isBlank()) {
            builder.claim("sid", sessionId);
        }

        return builder.compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public String extractSessionId(String token) {
        return extractClaim(token, claims -> claims.get("sid", String.class));
    }

    public Date extractIssuedAt(String token) {
        return extractClaim(token, Claims::getIssuedAt);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equalsIgnoreCase(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        Date expiration = extractClaim(token, Claims::getExpiration);
        return expiration.before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claimsResolver.apply(claims);
    }
}
