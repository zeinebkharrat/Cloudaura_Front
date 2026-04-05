package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.transport.TransportRecommendationRequest;
import org.example.backend.dto.transport.TransportRecommendationResponse;
import org.example.backend.service.TransportRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transport-recommendations")
@RequiredArgsConstructor
public class TransportRecommendationController {

    private final TransportRecommendationService recommendationService;

    @PostMapping
    public ApiResponse<TransportRecommendationResponse> getRecommendations(
            @RequestBody TransportRecommendationRequest request) {
        return ApiResponse.success(recommendationService.getRecommendations(request));
    }

    @GetMapping
    public ApiResponse<TransportRecommendationResponse> getRecommendationsGet(
            @RequestParam String fromCity,
            @RequestParam String toCity,
            @RequestParam(required = false, defaultValue = "1") int passengers,
            @RequestParam(required = false, defaultValue = "0") double budget,
            @RequestParam(required = false, defaultValue = "balanced") String preference,
            @RequestParam(required = false) String date) {
        
        TransportRecommendationRequest request = TransportRecommendationRequest.builder()
            .fromCity(fromCity)
            .toCity(toCity)
            .passengers(passengers)
            .budget(budget)
            .preference(preference)
            .date(date)
            .build();
        
        return ApiResponse.success(recommendationService.getRecommendations(request));
    }
}
