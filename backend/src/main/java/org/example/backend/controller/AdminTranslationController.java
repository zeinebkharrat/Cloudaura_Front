package org.example.backend.controller;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.example.backend.service.AdminTranslationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/translations")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminTranslationController {

    private final AdminTranslationService adminTranslationService;

    @PatchMapping("/{key:.+}/{lang}")
    public ResponseEntity<Void> overrideTranslation(
            @PathVariable("key") String key, @PathVariable("lang") String lang, @RequestBody Map<String, Object> body) {
        Object raw = body != null ? body.get("value") : null;
        if (raw == null) {
            return ResponseEntity.badRequest().build();
        }
        String value = raw.toString();
        if (value.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        adminTranslationService.overrideTranslation(key, lang, value);
        return ResponseEntity.ok().build();
    }
}
