package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.transport.TransportReservationRequest;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.dto.transport.TransportReservationUpdateRequest;
import org.example.backend.service.TransportReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/transport-reservations")
@RequiredArgsConstructor
public class TransportReservationController {
    private final TransportReservationService reservationService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TransportReservationResponse> create(@Valid @RequestBody TransportReservationRequest request) {
        return ApiResponse.success(reservationService.createReservation(request));
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<List<TransportReservationResponse>> getByUser(@PathVariable int userId) {
        return ApiResponse.success(reservationService.getUserReservations(userId));
    }

    @GetMapping("/{id}")
    public ApiResponse<TransportReservationResponse> getOne(@PathVariable int id, @RequestParam int userId) {
        return ApiResponse.success(reservationService.getReservationForUser(id, userId));
    }

    @PatchMapping("/{id}")
    public ApiResponse<TransportReservationResponse> update(
            @PathVariable int id,
            @RequestParam int userId,
            @RequestBody TransportReservationUpdateRequest body) {
        return ApiResponse.success(reservationService.updateReservation(id, userId, body));
    }

    @PatchMapping("/{id}/cancel")
    public ApiResponse<TransportReservationResponse> cancel(@PathVariable int id, @RequestParam int userId) {
        return ApiResponse.success(reservationService.cancelReservation(id, userId));
    }
}
