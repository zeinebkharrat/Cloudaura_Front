package org.example.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String ADMIN_USER = "admin";
    private static final String ADMIN_PASS = "admin123";
    private static final String USER_USER  = "user";
    private static final String USER_PASS  = "user123";

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String username = body.getOrDefault("username", "");
        String password = body.getOrDefault("password", "");

        if (ADMIN_USER.equals(username) && ADMIN_PASS.equals(password)) {
            return ResponseEntity.ok(Map.of(
                "success", true, "role", "ADMIN",
                "username", username, "message", "Bienvenue, administrateur !"
            ));
        }
        if (USER_USER.equals(username) && USER_PASS.equals(password)) {
            return ResponseEntity.ok(Map.of(
                "success", true, "role", "USER",
                "username", username, "message", "Bienvenue !"
            ));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
            "success", false, "message", "Identifiants invalides"
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Boolean>> logout() {
        return ResponseEntity.ok(Map.of("success", true));
    }
}
