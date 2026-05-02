package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityRecommendationRefinementRequest;
import org.example.backend.dto.CityRecommendationRefinementResponse;
import org.example.backend.service.CityRecommendationAiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/recommendation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CityRecommendationAiController {

    private final CityRecommendationAiService aiService;

    @PostMapping("/refine")
    public ResponseEntity<CityRecommendationRefinementResponse> refine(@RequestBody CityRecommendationRefinementRequest request) {
        return ResponseEntity.ok(aiService.refineRecommendations(request));
    }
}
