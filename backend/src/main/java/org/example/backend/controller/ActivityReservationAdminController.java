package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityReservationListItemResponse;
import org.example.backend.dto.PageResponse;
import org.example.backend.model.ReservationStatus;
import org.example.backend.service.ActivityReservationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.DateTimeException;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/activity-reservations")
@RequiredArgsConstructor
public class ActivityReservationAdminController {

    private final ActivityReservationService activityReservationService;

    @GetMapping
    public PageResponse<ActivityReservationListItemResponse> list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Integer activityId,
        @RequestParam(required = false) Integer userId,
        @RequestParam(required = false) ReservationStatus status,
        @RequestParam(required = false) String reservationDate,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "reservationDate,desc") String sort
    ) {
        LocalDate parsedDate;
        try {
            parsedDate = (reservationDate == null || reservationDate.isBlank()) ? null : LocalDate.parse(reservationDate);
        } catch (DateTimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservationDate invalide (yyyy-MM-dd)");
        }
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(activityReservationService.listAdmin(q, activityId, userId, status, parsedDate, pageable));
    }

    private Pageable buildPageable(int page, int size, String sort) {
        String[] sortParts = sort.split(",");
        String sortBy = sortParts[0].trim();
        Sort.Direction direction = (sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1]))
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(direction, sortBy));
    }
}
