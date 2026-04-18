package org.example.backend.config;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.exception.CancellationNotAllowedException;
import org.example.backend.exception.DuplicateReservationException;
import org.example.backend.exception.ExposableException;
import org.example.backend.exception.InvalidInputException;
import org.example.backend.exception.InvalidTransportException;
import org.example.backend.exception.NoSeatsAvailableException;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.exception.RoomNotAvailableException;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.service.CatalogTranslationService;
import org.example.backend.service.flight.DuffelUpstreamException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.jpa.JpaObjectRetrievalFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.apache.catalina.connector.ClientAbortException;
import jakarta.persistence.EntityNotFoundException;

@RestControllerAdvice
@Slf4j
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final CatalogTranslationService catalogTranslationService;

    private <T> ResponseEntity<T> json(HttpStatus status, T body) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    private ResponseEntity<ApiResponse<Void>> err(HttpStatus status, String message, String code) {
        return json(status, ApiResponse.error(message, code, status.value()));
    }

    private String resolve(String catalogKey, String frenchFallback) {
        try {
            return catalogTranslationService.resolveForRequest(catalogKey, frenchFallback);
        } catch (Exception ex) {
            log.warn("Catalog translation lookup failed for key='{}': {}", catalogKey, ex.getMessage());
            if (frenchFallback != null && !frenchFallback.isBlank()) {
                return frenchFallback;
            }
            return catalogKey != null ? catalogKey : "La requête a échoué.";
        }
    }

    private String normalizeCatalogKeyOrFallback(String candidate, String fallbackKey) {
        if (CatalogKeyUtil.looksLikeCatalogKey(candidate)) {
            return candidate.trim();
        }
        return fallbackKey;
    }

    private static String defaultKeyForHttpStatus(HttpStatus status) {
        if (status == null) {
            return "api.error.request_failed";
        }
        return switch (status) {
            case NOT_FOUND -> "api.error.not_found";
            case UNAUTHORIZED -> "api.error.unauthorized";
            case FORBIDDEN -> "api.error.forbidden";
            case CONFLICT -> "api.error.conflict";
            case BAD_REQUEST, UNPROCESSABLE_ENTITY -> "api.error.bad_request";
            case PAYLOAD_TOO_LARGE -> "api.error.upload_too_large";
            case BAD_GATEWAY, SERVICE_UNAVAILABLE, GATEWAY_TIMEOUT -> "api.error.external_service_unavailable";
            default -> status.is5xxServerError() ? "api.error.internal" : "api.error.request_failed";
        };
    }

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthCredentialsMissing(
            AuthenticationCredentialsNotFoundException ex) {
        String key = normalizeCatalogKeyOrFallback(ex.getMessage(), "api.error.unauthorized");
        String message = resolve(key, "Authentification requise.");
        return err(HttpStatus.UNAUTHORIZED, message, key);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        String raw = ex.getMessage();
        String key = normalizeCatalogKeyOrFallback(raw, "api.error.access_denied");
        if (!CatalogKeyUtil.looksLikeCatalogKey(raw)) {
            log.debug("AccessDenied without catalog key; using {}", key);
        }
        String message = resolve(key, "Accès refusé");
        return err(HttpStatus.FORBIDDEN, message, key);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        String key = ex.getCatalogKey();
        if (!CatalogKeyUtil.looksLikeCatalogKey(key)) {
            log.warn("ResourceNotFoundException without catalog key (normalized to api.error.not_found): {}", key);
            key = "api.error.not_found";
        }
        String message = resolve(key, "Ressource introuvable.");
        return err(HttpStatus.NOT_FOUND, message, key);
    }

    @ExceptionHandler(NoSeatsAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoSeats(NoSeatsAvailableException e) {
        String key = e.getCatalogKey();
        if (!CatalogKeyUtil.looksLikeCatalogKey(key)) {
            log.warn("NoSeatsAvailableException without catalog key");
            key = "reservation.error.no_seats_for_trip";
        }
        String message = resolve(key, "Plus de places disponibles pour ce voyage.");
        return err(HttpStatus.BAD_REQUEST, message, key);
    }

    @ExceptionHandler(DuplicateReservationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateReservationException e) {
        String key = e.getCatalogKey();
        if (!CatalogKeyUtil.looksLikeCatalogKey(key)) {
            key = "api.error.conflict";
        }
        String message = resolve(key, "Conflit de réservation.");
        return err(HttpStatus.CONFLICT, message, key);
    }

    @ExceptionHandler(RoomNotAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleRoomNotAvailable(RoomNotAvailableException e) {
        String key = e.getCatalogKey();
        if (!CatalogKeyUtil.looksLikeCatalogKey(key)) {
            key = "reservation.error.room_unavailable_dates";
        }
        String message = resolve(key, "Chambre indisponible pour ces dates.");
        return err(HttpStatus.BAD_REQUEST, message, key);
    }

    @ExceptionHandler(CancellationNotAllowedException.class)
    public ResponseEntity<ApiResponse<Void>> handleCancellationNotAllowed(CancellationNotAllowedException e) {
        String key = e.getCatalogKey();
        if (!CatalogKeyUtil.looksLikeCatalogKey(key)) {
            key = "reservation.error.cancellation_window";
        }
        String message = resolve(key, "Annulation impossible.");
        return err(HttpStatus.BAD_REQUEST, message, key);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> parts = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            parts.add(localizeFieldError(fe));
        }
        for (ObjectError oe : ex.getBindingResult().getGlobalErrors()) {
            if (!(oe instanceof FieldError)) {
                parts.add(localizeObjectError(oe));
            }
        }
        String message =
                parts.isEmpty()
                        ? resolve("api.error.validation_failed", "Échec de validation")
                        : String.join("; ", parts);
        return err(HttpStatus.UNPROCESSABLE_ENTITY, message, "api.error.validation_failed");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        List<String> parts =
                ex.getConstraintViolations().stream()
                        .map(this::localizeConstraintViolation)
                        .collect(Collectors.toList());
        String message =
                parts.isEmpty()
                        ? resolve("api.error.validation_failed", "Échec de validation")
                        : String.join("; ", parts);
        return err(HttpStatus.BAD_REQUEST, message, "api.error.validation_failed");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String detail = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : "";
        String d = detail == null ? "" : detail;
        String dl = d.toLowerCase();
        String msg;
        String code;
        if (dl.contains("foreign key")) {
            code = "api.error.data_integrity_fk";
            msg = resolve(code, "Cet enregistrement ne peut pas être supprimé.");
        } else if (d.contains("users") || d.contains("user_roles") || d.contains("email") || d.contains("Email")
                || d.contains("username") || d.contains("Username")) {
            if (d.contains("email") || d.contains("Email")) {
                code = "api.error.duplicate_email";
                msg = resolve(code, "Cet e-mail est déjà enregistré.");
            } else if (d.contains("username") || d.contains("Username")) {
                code = "api.error.duplicate_username";
                msg = resolve(code, "Ce nom d'utilisateur est déjà pris.");
            } else {
                code = "api.error.duplicate_generic";
                msg = resolve(code, "Cet e-mail ou ce nom d'utilisateur est déjà enregistré.");
            }
        } else if (d.contains("quiz") || d.contains("quiz_questions") || d.contains("quizzes")) {
            code = "api.error.data_integrity_quiz";
            msg = resolve(code, "Conflit de données quiz.");
        } else {
            code = "api.error.data_integrity_generic";
            msg = resolve(code, "Cette opération entre en conflit avec des données existantes.");
        }
        return err(HttpStatus.CONFLICT, msg, code);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String reason = ex.getReason();
        if (status.is5xxServerError()) {
            log.warn("ResponseStatus {} (reason redacted from client): {}", status, reason);
            String key = "api.error.internal";
            return err(status, resolve(key, "Une erreur inattendue s'est produite."), key);
        }
        String key;
        if (CatalogKeyUtil.looksLikeCatalogKey(reason)) {
            key = reason.trim();
        } else {
            log.warn("ResponseStatus {} with non-catalog reason (redacted from client): {}", status, reason);
            key = defaultKeyForHttpStatus(status);
        }
        String message = resolve(key, "La requête a échoué.");
        return err(status, message, key);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return err(
                HttpStatus.PAYLOAD_TOO_LARGE,
                resolve("api.error.upload_too_large", "Fichier trop volumineux"),
                "api.error.upload_too_large");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadable(HttpMessageNotReadableException ex) {
        log.debug("Unreadable HTTP message: {}", ex.getClass().getSimpleName());
        return err(
                HttpStatus.BAD_REQUEST,
                resolve("api.error.invalid_payload", "Corps de requête invalide"),
                "api.error.invalid_payload");
    }

    @ExceptionHandler(InvalidTransportException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidTransport(InvalidTransportException ex) {
        log.warn("InvalidTransport (redacted from client): {}", ex.getMessage());
        String key = "api.error.transport_validation";
        return err(
                HttpStatus.UNPROCESSABLE_ENTITY,
                resolve(key, "Les informations de transport ne sont pas valides."),
                key);
    }

    @ExceptionHandler(DuffelUpstreamException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuffel(DuffelUpstreamException ex) {
        int code = ex.getHttpStatus();
        HttpStatus status = (code >= 400 && code < 600) ? HttpStatus.valueOf(code) : HttpStatus.BAD_GATEWAY;
        log.warn("Duffel upstream (redacted from client): {}", ex.getMessage());

        if (status == HttpStatus.CONFLICT) {
            String key = "api.error.flight.offer_conflict";
            return err(
                    HttpStatus.CONFLICT,
                    resolve(key, "This offer is no longer available. Please search again."),
                    key);
        }

        String key = "api.error.external_service_unavailable";
        return err(
                status,
                resolve(key, "Service externe momentanément indisponible."),
                key);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : "Request method is not supported";
        return json(
                HttpStatus.METHOD_NOT_ALLOWED,
                ApiResponse.error(message, "METHOD_NOT_ALLOWED"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        log.error("IllegalArgument captured (exposable={}): {}", ex instanceof ExposableException, ex.getMessage(), ex);

        if (ex instanceof ExposableException) {
            String key = "api.error.invalid_payload";
            if (ex instanceof InvalidInputException iie) {
                key = normalizeCatalogKeyOrFallback(iie.getCatalogKey(), key);
            }
            String safeMessage = (ex.getMessage() == null || ex.getMessage().isBlank())
                    ? resolve(key, "Corps de requête invalide")
                    : ex.getMessage();
            return err(HttpStatus.BAD_REQUEST, safeMessage, key);
        }

        return err(
                HttpStatus.BAD_REQUEST,
                resolve("api.error.invalid_payload", "Corps de requête invalide"),
                "api.error.invalid_payload");
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalState(IllegalStateException ex) {
        log.error("IllegalState (redacted from client): {}", ex.getMessage());
        String key = "api.error.internal";
        return err(
                HttpStatus.INTERNAL_SERVER_ERROR,
                resolve(key, "Une erreur inattendue s'est produite."),
                key);
    }

    @ExceptionHandler({JpaObjectRetrievalFailureException.class, EntityNotFoundException.class})
    public ResponseEntity<ApiResponse<Void>> handleJpaEntityNotFound(Exception ex) {
        String key = "api.error.not_found";
        log.warn("JPA entity reference not found (redacted from client): {}", ex.getMessage());
        return err(HttpStatus.NOT_FOUND, resolve(key, "Ressource introuvable."), key);
    }

    @ExceptionHandler(ClientAbortException.class)
    public ResponseEntity<Void> handleClientAbort(ClientAbortException ex) {
        log.debug("Client aborted response stream: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnhandled(Exception ex) {
        log.error("Unhandled server error", ex);
        String key = "api.error.internal";
        return err(
                HttpStatus.INTERNAL_SERVER_ERROR,
                resolve(key, "Une erreur inattendue s'est produite."),
                key);
    }

    private String localizeFieldError(FieldError fe) {
        String field = fe.getField();
        String constraint = extractConstraintName(fe.getCodes(), fe.getCode());
        String key = mapConstraintToCatalogKey(constraint);
        String text = resolve(key, defaultFrenchForValidationKey(key));
        return field + ": " + text;
    }

    private String localizeObjectError(ObjectError oe) {
        String object = oe.getObjectName() != null ? oe.getObjectName() : "request";
        String constraint = extractConstraintName(oe.getCodes(), oe.getCode());
        String key = mapConstraintToCatalogKey(constraint);
        String text = resolve(key, defaultFrenchForValidationKey(key));
        return object + ": " + text;
    }

    private String localizeConstraintViolation(ConstraintViolation<?> v) {
        String field = fieldNameFromPath(v.getPropertyPath());
        String ann =
                v.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName();
        String key = mapConstraintToCatalogKey(ann);
        String text = resolve(key, defaultFrenchForValidationKey(key));
        return field + ": " + text;
    }

    private static String fieldNameFromPath(Path path) {
        String name = "value";
        for (Path.Node node : path) {
            if (node.getName() != null) {
                name = node.getName();
            }
        }
        return name;
    }

    private static String extractConstraintName(String[] codes, String defaultCode) {
        if (codes != null && codes.length > 0) {
            String first = codes[0];
            if (first != null && !first.isBlank()) {
                int dot = first.indexOf('.');
                if (dot > 0) {
                    return first.substring(0, dot);
                }
                return first;
            }
        }
        return defaultCode != null ? defaultCode : "";
    }

    private static String mapConstraintToCatalogKey(String constraint) {
        if (constraint == null || constraint.isBlank()) {
            return "api.error.validation.unknown_field";
        }
        String c = constraint.trim();
        if ("typeMismatch".equalsIgnoreCase(c)) {
            return "api.error.validation.invalid_format";
        }
        return switch (c) {
            case "NotNull", "NotBlank", "NotEmpty", "AssertTrue", "AssertFalse" -> "api.error.validation.required";
            case "Email", "URL", "UUID", "Pattern", "CreditCardNumber" -> "api.error.validation.invalid_format";
            case "Size", "Length" -> "api.error.validation.invalid_format";
            case "Min", "DecimalMin", "Digits" -> "api.error.validation.too_short";
            case "Max", "DecimalMax" -> "api.error.validation.too_long";
            case "Past", "PastOrPresent", "Future", "FutureOrPresent" -> "api.error.validation.invalid_format";
            default -> "api.error.validation.unknown_field";
        };
    }

    private static String defaultFrenchForValidationKey(String key) {
        return switch (key) {
            case "api.error.validation.required" -> "Ce champ est obligatoire.";
            case "api.error.validation.invalid_format" -> "Format ou valeur non valide.";
            case "api.error.validation.too_short" -> "Valeur trop courte ou trop petite.";
            case "api.error.validation.too_long" -> "Valeur trop longue ou trop grande.";
            case "api.error.validation.unknown_field" -> "Contrainte de validation non reconnue pour ce champ.";
            default -> "Contrainte non reconnue.";
        };
    }
}
