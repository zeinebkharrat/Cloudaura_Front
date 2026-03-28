package com.yallatn.controller.transport;

import com.yallatn.dto.ApiResponse;
import com.yallatn.dto.transport.TransportReservationRequest;
import com.yallatn.dto.transport.TransportReservationResponse;
import com.yallatn.service.transport.TransportReservationService;
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
    public ApiResponse<TransportReservationResponse> create(@RequestBody TransportReservationRequest request) {
        return ApiResponse.success(reservationService.createReservation(request));
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<List<TransportReservationResponse>> getByUser(@PathVariable int userId) {
        return ApiResponse.success(reservationService.getUserReservations(userId));
    }

    @PatchMapping("/{id}/cancel")
    public ApiResponse<TransportReservationResponse> cancel(@PathVariable int id, @RequestParam int userId) {
        return ApiResponse.success(reservationService.cancelReservation(id, userId));
    }
}
