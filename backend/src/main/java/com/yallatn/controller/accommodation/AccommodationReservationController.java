package com.yallatn.controller.accommodation;

import com.yallatn.dto.ApiResponse;
import com.yallatn.dto.accommodation.AccommodationReservationRequest;
import com.yallatn.dto.accommodation.AccommodationReservationResponse;
import com.yallatn.service.accommodation.AccommodationReservationService;
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
