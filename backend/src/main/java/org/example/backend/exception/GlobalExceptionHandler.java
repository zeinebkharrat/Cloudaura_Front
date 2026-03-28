package org.example.backend.exception;

import org.example.backend.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.<Void>builder()
                        .success(false)
                        .message(e.getMessage())
                        .errorCode("RESOURCE_NOT_FOUND")
                        .timestamp(LocalDateTime.now())
                        .build());
    }

    @ExceptionHandler(NoSeatsAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoSeats(NoSeatsAvailableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Void>builder()
                        .success(false)
                        .message(e.getMessage())
                        .errorCode("NO_SEATS_AVAILABLE")
                        .timestamp(LocalDateTime.now())
                        .build());
    }

    @ExceptionHandler(DuplicateReservationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateReservationException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.<Void>builder()
                        .success(false)
                        .message(e.getMessage())
                        .errorCode("DUPLICATE_RESERVATION")
                        .timestamp(LocalDateTime.now())
                        .build());
    }

    @ExceptionHandler(RoomNotAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleRoomNotAvailable(RoomNotAvailableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Void>builder()
                        .success(false)
                        .message(e.getMessage())
                        .errorCode("ROOM_NOT_AVAILABLE")
                        .timestamp(LocalDateTime.now())
                        .build());
    }

    @ExceptionHandler(CancellationNotAllowedException.class)
    public ResponseEntity<ApiResponse<Void>> handleCancellationNotAllowed(CancellationNotAllowedException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Void>builder()
                        .success(false)
                        .message(e.getMessage())
                        .errorCode("CANCELLATION_NOT_ALLOWED")
                        .timestamp(LocalDateTime.now())
                        .build());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.<Void>builder()
                        .success(false)
                        .message("Erreur interne : " + e.getMessage())
                        .errorCode("INTERNAL_SERVER_ERROR")
                        .timestamp(LocalDateTime.now())
                        .build());
    }
}
