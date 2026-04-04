package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.accommodation.AccommodationReservationRequest;
import org.example.backend.dto.accommodation.AccommodationReservationResponse;
import org.example.backend.service.AccommodationReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
public class AccommodationReservationController {
    private final AccommodationReservationService reservationService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AccommodationReservationResponse> create(@RequestBody AccommodationReservationRequest request) {
        return ApiResponse.success(reservationService.createReservation(request));
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<List<AccommodationReservationResponse>> getByUser(@PathVariable int userId) {
        return ApiResponse.success(reservationService.getUserReservations(userId));
    }

    @PatchMapping("/{id}/cancel")
    public ApiResponse<AccommodationReservationResponse> cancel(@PathVariable int id, @RequestParam int userId) {
        return ApiResponse.success(reservationService.cancelReservation(id, userId));
    }
}
