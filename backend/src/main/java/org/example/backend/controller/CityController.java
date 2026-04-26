package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.LocalizedCityResponse;
import org.example.backend.model.City;
import org.example.backend.repository.CityRepository;
import org.example.backend.service.CatalogTranslationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.List;

@RestController
@RequestMapping("/api/cities")
@RequiredArgsConstructor
public class CityController {
    private final CityRepository cityRepository;
    private final CatalogTranslationService catalogTranslationService;

    @GetMapping
    public ApiResponse<List<LocalizedCityResponse>> getAll(@RequestParam(defaultValue = "fr") String lang) {
        List<LocalizedCityResponse> rows = cityRepository.findAll().stream()
                .filter(c -> !c.isVirtualFlightEndpointCity())
                .map(c -> LocalizedCityResponse.from(c, lang, catalogTranslationService))
                .toList();
        return ApiResponse.success(rows);
    }

    @GetMapping("/{id}")
    public ApiResponse<LocalizedCityResponse> getById(
            @PathVariable int id,
            @RequestParam(defaultValue = "fr") String lang) {
        City city = cityRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.city_not_found"));
        return ApiResponse.success(LocalizedCityResponse.from(city, lang, catalogTranslationService));
    }
}
