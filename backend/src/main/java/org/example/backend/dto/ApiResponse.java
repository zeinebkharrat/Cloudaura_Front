package org.example.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String message;
    /** Machine-readable error identifier; serialized as {@code code} in JSON. */
    @JsonProperty("code")
    @JsonAlias("errorCode")
    private String errorCode;
    /** HTTP status when this body represents an error (mirrors response status). */
    private Integer status;
    private LocalDateTime timestamp;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .message("OK")
                .timestamp(LocalDateTime.now())
                .build();
    }

    /** Success with a user-visible message (e.g. soft-delete / alternate outcome). */
    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .message(message != null && !message.isBlank() ? message : "OK")
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> error(String message, String errorCode) {
        return error(message, errorCode, null);
    }

    public static <T> ApiResponse<T> error(String message, String errorCode, Integer httpStatus) {
        return ApiResponse.<T>builder()
                .success(false)
                .data(null)
                .message(message)
                .errorCode(errorCode)
                .status(httpStatus)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
