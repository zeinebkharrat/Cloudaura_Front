package org.example.backend.config;

import java.util.LinkedHashMap;
import java.util.Map;
import org.example.backend.controller.TranslationController;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * JSON error contract for {@link TranslationController} only (narrower than {@link GlobalExceptionHandler}).
 */
@RestControllerAdvice(assignableTypes = TranslationController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TranslationExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String field = "";
        String message = "";
        FieldError fe = ex.getBindingResult().getFieldError();
        if (fe != null) {
            field = fe.getField() != null ? fe.getField() : "";
            message = fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "";
        }
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", "validation");
        body.put("field", field);
        body.put("message", message);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", "bad_request");
        body.put("message", ex.getMessage() != null ? ex.getMessage() : "");
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleAny(Exception ex) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", "internal");
        body.put("message", "Translation service unavailable");
        return ResponseEntity.internalServerError().body(body);
    }
}
