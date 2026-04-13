package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.TranslateApiRequest;
import org.example.backend.dto.TranslateApiResponse;
import org.example.backend.service.TranslationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/translate")
@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:4200}")
public class TranslationController {

    private final TranslationService translationService;

    public TranslationController(TranslationService translationService) {
        this.translationService = translationService;
    }

    @PostMapping
    public ResponseEntity<TranslateApiResponse> translate(@Valid @RequestBody TranslateApiRequest request)
            throws Exception {
        String text = request.getText() == null ? "" : request.getText();
        String out = translationService.translate(text, request.getSourceLang(), request.getTargetLang());
        TranslateApiResponse res =
                new TranslateApiResponse(out, request.getSourceLang(), request.getTargetLang());
        return ResponseEntity.ok(res);
    }
}
