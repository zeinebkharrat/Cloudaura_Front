package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.accommodation.AccommodationSearchRequest;
import org.example.backend.dto.accommodation.AccommodationSearchResponse;
import org.example.backend.service.AccommodationService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/accommodations")
@RequiredArgsConstructor
public class AccommodationController {
    private final AccommodationService accommodationService;

    @GetMapping("/search")
    public ApiResponse<List<AccommodationSearchResponse>> search(
            @RequestParam(required = false) Integer cityId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut) {
        
        AccommodationSearchRequest request = AccommodationSearchRequest.builder()
                .cityId(cityId)
                .type(type)
                .minPrice(minPrice)
                .maxPrice(maxPrice)
                .minRating(minRating)
                .checkIn(checkIn)
                .checkOut(checkOut)
                .build();
        
        return ApiResponse.success(accommodationService.searchAccommodations(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<AccommodationSearchResponse> getDetails(
            @PathVariable int id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut) {
        
        return ApiResponse.success(accommodationService.getAccommodationDetails(
                id, 
                checkIn != null ? checkIn.atStartOfDay() : null, 
                checkOut != null ? checkOut.atStartOfDay() : null));
    }
}
