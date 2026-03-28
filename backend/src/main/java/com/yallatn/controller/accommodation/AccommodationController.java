package com.yallatn.controller.accommodation;

import com.yallatn.dto.ApiResponse;
import com.yallatn.dto.accommodation.AccommodationSearchRequest;
import com.yallatn.dto.accommodation.AccommodationSearchResponse;
import com.yallatn.service.accommodation.AccommodationService;
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
            @RequestParam int cityId,
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
