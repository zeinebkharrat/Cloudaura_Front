package org.example.backend.config;

import org.example.backend.dto.ApiErrorResponse;
import org.example.backend.dto.ApiResponse;
import org.example.backend.exception.*;
import org.example.backend.exception.InvalidTransportException;
import org.example.backend.exception.VehicleConflictException;
import org.example.backend.exception.DriverConflictException;
import org.springframework.http.MediaType;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private <T> ResponseEntity<T> json(HttpStatus status, T body) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : "Access denied";
        return json(HttpStatus.FORBIDDEN, ApiResponse.error(message, "ACCESS_DENIED"));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return json(HttpStatus.NOT_FOUND, ApiResponse.error(ex.getMessage(), "RESOURCE_NOT_FOUND"));
    }

    @ExceptionHandler(NoSeatsAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoSeats(NoSeatsAvailableException e) {
        return json(HttpStatus.BAD_REQUEST, ApiResponse.error(e.getMessage(), "NO_SEATS_AVAILABLE"));
    }

    @ExceptionHandler(DuplicateReservationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateReservationException e) {
        return json(HttpStatus.CONFLICT, ApiResponse.error(e.getMessage(), "DUPLICATE_RESERVATION"));
    }

    @ExceptionHandler(RoomNotAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleRoomNotAvailable(RoomNotAvailableException e) {
        return json(HttpStatus.BAD_REQUEST, ApiResponse.error(e.getMessage(), "ROOM_NOT_AVAILABLE"));
    }

    @ExceptionHandler(CancellationNotAllowedException.class)
    public ResponseEntity<ApiResponse<Void>> handleCancellationNotAllowed(CancellationNotAllowedException e) {
        return json(HttpStatus.BAD_REQUEST, ApiResponse.error(e.getMessage(), "CANCELLATION_NOT_ALLOWED"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));

        return json(HttpStatus.UNPROCESSABLE_ENTITY,
            ApiResponse.error("Validation failed: " + message, "VALIDATION_ERROR"));
    }

    /** Doublon en base (course entre deux inscriptions, contrainte unique, etc.) — évite un 500 générique. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String detail = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : "";
        String d = detail == null ? "" : detail;
        String dl = d.toLowerCase();
        String msg;
        String code;
        if (dl.contains("foreign key")) {
            msg = "This record cannot be removed because other data still references it (for example bookings). Cancel or unlink them first, or deactivate instead.";
            code = "FK_CONSTRAINT";
        } else if (d.contains("users") || d.contains("user_roles") || d.contains("email") || d.contains("Email")
                || d.contains("username") || d.contains("Username")) {
            msg = "This email or username is already registered.";
            if (d.contains("email") || d.contains("Email")) {
                msg = "This email is already registered.";
            } else if (d.contains("username") || d.contains("Username")) {
                msg = "This username is already taken.";
            }
            code = "DUPLICATE_ENTRY";
        } else if (d.contains("quiz") || d.contains("quiz_questions") || d.contains("quizzes")) {
            msg = "Quiz data conflicts with existing records (duplicate key or constraint). If you were saving a quiz, retry after refreshing the admin page.";
            code = "DUPLICATE_ENTRY";
        } else {
            msg = "This operation conflicts with existing data (duplicate or constraint).";
            code = "DATA_INTEGRITY";
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(msg, code));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        return json(status, ApiResponse.error(ex.getReason() != null ? ex.getReason() : "Request failed", status.name()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return json(HttpStatus.PAYLOAD_TOO_LARGE, ApiResponse.error("Uploaded file is too large", "UPLOAD_SIZE_EXCEEDED"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadable(HttpMessageNotReadableException ex) {
        return json(HttpStatus.BAD_REQUEST, ApiResponse.error("Invalid request payload", "BAD_REQUEST"));
    }

    @ExceptionHandler(InvalidTransportException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidTransport(InvalidTransportException ex) {
        return json(HttpStatus.UNPROCESSABLE_ENTITY, ApiResponse.error(ex.getMessage(), ex.getErrorCode()));
    }

    @ExceptionHandler(VehicleConflictException.class)
    public ResponseEntity<ApiResponse<Void>> handleVehicleConflict(VehicleConflictException ex) {
        return json(HttpStatus.CONFLICT, ApiResponse.error(ex.getMessage(), "VEHICLE_CONFLICT"));
    }

    @ExceptionHandler(DriverConflictException.class)
    public ResponseEntity<ApiResponse<Void>> handleDriverConflict(DriverConflictException ex) {
        return json(HttpStatus.CONFLICT, ApiResponse.error(ex.getMessage(), "DRIVER_CONFLICT"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        ApiErrorResponse body = new ApiErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                ex.getMessage() != null ? ex.getMessage() : "Invalid request",
                Instant.now(),
                Map.of()
        );

        return json(HttpStatus.BAD_REQUEST, body);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalState(IllegalStateException ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : "Operation could not be completed";
        ApiErrorResponse body = new ApiErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                message,
                Instant.now(),
                Map.of()
        );

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnhandled(Exception ex) {
        log.error("Unhandled server error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(
                        "An unexpected error occurred. Please try again later.",
                        "INTERNAL_SERVER_ERROR"));
    }
}
