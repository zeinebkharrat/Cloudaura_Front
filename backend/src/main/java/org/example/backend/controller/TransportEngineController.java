package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.transport.EngineRecommendationRequest;
import org.example.backend.dto.transport.EngineRecommendationResponse;
import org.example.backend.service.TransportEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Transport Intelligence Engine – HTTP surface.
 *
 * POST /api/engine/recommend  – Full JSON body (city IDs preferred)
 * GET  /api/engine/recommend  – Query-params shortcut (city names for quick testing)
 */
@RestController
@RequestMapping("/api/engine")
@RequiredArgsConstructor
public class TransportEngineController {

    private final TransportEngineService engineService;

    @PostMapping("/recommend")
    public ApiResponse<EngineRecommendationResponse> recommend(
            @RequestBody EngineRecommendationRequest request) {
        return ApiResponse.success(engineService.recommend(request));
    }

    @GetMapping("/recommend")
    public ApiResponse<EngineRecommendationResponse> recommendGet(
            @RequestParam(required = false) Integer fromCityId,
            @RequestParam(required = false) Integer toCityId,
            @RequestParam(required = false) String  fromCity,
            @RequestParam(required = false) String  toCity,
            @RequestParam(required = false, defaultValue = "1")        int    passengers,
            @RequestParam(required = false, defaultValue = "balanced")  String preference,
            @RequestParam(required = false)                             String date) {

        EngineRecommendationRequest req = EngineRecommendationRequest.builder()
            .fromCityId(fromCityId).toCityId(toCityId)
            .fromCity(fromCity).toCity(toCity)
            .passengers(passengers).preference(preference).date(date)
            .build();

        return ApiResponse.success(engineService.recommend(req));
    }
}
