package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.transport.TransportReservationRequest;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.dto.transport.TransportReservationUpdateRequest;
import org.example.backend.service.TransportReservationService;
import org.example.backend.service.UserIdentityResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/api/transport-reservations")
@RequiredArgsConstructor
public class TransportReservationController {
    private final TransportReservationService reservationService;
    private final UserIdentityResolver userIdentityResolver;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TransportReservationResponse> create(@RequestBody TransportReservationRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Integer userId = userIdentityResolver.resolveUserId(authentication);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.unauthorized");
        }
        return ApiResponse.success(reservationService.createReservationForUser(request, userId));
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<List<TransportReservationResponse>> getByUser(@PathVariable int userId) {
        return ApiResponse.success(reservationService.getUserReservations(userId));
    }

    @GetMapping("/my")
    public ApiResponse<List<TransportReservationResponse>> getMy() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Integer userId = userIdentityResolver.resolveUserId(authentication);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.unauthorized");
        }
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
