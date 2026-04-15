package org.example.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Regression: short Base64-decoded keys must not crash with JJWT WeakKeyException; UTF-8 secrets need 32+ bytes.
 */
class JwtServiceKeyMaterialTest {

    private static JwtService serviceWithSecret(String secret) {
        JwtService s = new JwtService();
        ReflectionTestUtils.setField(s, "secret", secret);
        ReflectionTestUtils.setField(s, "expirationMs", 86_400_000L);
        return s;
    }

    @Test
    void init_succeedsWith32ByteUtf8Secret() {
        JwtService s = serviceWithSecret("abcdefghijklmnopqrstuvwxyz0123456789abcdef");
        assertDoesNotThrow(s::init);
    }

    @Test
    void init_failsWhenSecretIsShortBase64ThatDecodesUnder32Bytes() {
        JwtService s = serviceWithSecret("YWJj");
        assertThrows(IllegalStateException.class, s::init);
    }

    @Test
    void init_failsWhenUtf8SecretTooShort() {
        JwtService s = serviceWithSecret("tooshort");
        assertThrows(IllegalStateException.class, s::init);
    }

    @Test
    void init_failsWhenEmptySecret() {
        JwtService s = serviceWithSecret("   ");
        assertThrows(IllegalStateException.class, s::init);
    }
}
