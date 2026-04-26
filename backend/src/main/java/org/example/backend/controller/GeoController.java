package org.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.GeoReverseResponse;
import org.example.backend.model.City;
import org.example.backend.repository.CityRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/geo")
@RequiredArgsConstructor
@Slf4j
public class GeoController {

    private final RestTemplate restTemplate;
    private final CityRepository cityRepository;

    private static final String NOMINATIM_REVERSE =
            "https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=10&addressdetails=1&accept-language=fr";

    @GetMapping("/reverse")
    public ApiResponse<GeoReverseResponse> reverseGeocode(
            @RequestParam double lat, @RequestParam double lng) {

        try {
            JsonNode nominatim = restTemplate.getForObject(
                    NOMINATIM_REVERSE, JsonNode.class, lat, lng);

            if (nominatim == null || !nominatim.has("address")) {
                return ApiResponse.success(GeoReverseResponse.builder()
                        .latitude(lat).longitude(lng)
                        .matchedInSystem(false)
                        .rawLocationName("Inconnu")
                        .build());
            }

            JsonNode address = nominatim.get("address");
            String locationName = extractCityName(address);

            Optional<City> matched = findBestMatch(locationName);

            if (matched.isPresent()) {
                City c = matched.get();
                return ApiResponse.success(GeoReverseResponse.builder()
                        .cityId(c.getCityId())
                        .name(c.getName())
                        .region(c.getRegion())
                        .latitude(c.getLatitude())
                        .longitude(c.getLongitude())
                        .matchedInSystem(true)
                        .rawLocationName(locationName)
                        .build());
            }

            return ApiResponse.success(GeoReverseResponse.builder()
                    .latitude(lat).longitude(lng)
                    .matchedInSystem(false)
                    .rawLocationName(locationName)
                    .build());

        } catch (Exception e) {
            log.warn("Nominatim reverse geocoding failed for ({}, {}): {}", lat, lng, e.getMessage());
            return ApiResponse.success(GeoReverseResponse.builder()
                    .latitude(lat).longitude(lng)
                    .matchedInSystem(false)
                    .rawLocationName("Geocoding error")
                    .build());
        }
    }

    @GetMapping("/resolve")
    public ApiResponse<GeoReverseResponse> resolveByName(@RequestParam String name) {
        Optional<City> match = findBestMatch(name);
        if (match.isPresent()) {
            City c = match.get();
            return ApiResponse.success(GeoReverseResponse.builder()
                    .cityId(c.getCityId())
                    .name(c.getName())
                    .region(c.getRegion())
                    .latitude(c.getLatitude())
                    .longitude(c.getLongitude())
                    .matchedInSystem(true)
                    .rawLocationName(name)
                    .build());
        }
        return ApiResponse.success(GeoReverseResponse.builder()
                .matchedInSystem(false)
                .rawLocationName(name)
                .build());
    }

    private String extractCityName(JsonNode address) {
        for (String key : List.of("city", "town", "village", "municipality", "state")) {
            if (address.has(key) && !address.get(key).asText().isBlank()) {
                return address.get(key).asText();
            }
        }
        return address.has("display_name") ? address.get("display_name").asText() : "Inconnu";
    }

    private Optional<City> findBestMatch(String locationName) {
        if (locationName == null || locationName.isBlank()) return Optional.empty();

        Optional<City> exact = cityRepository.findByName(locationName);
        if (exact.isPresent()) {
            return exact.filter(c -> !c.isExcludedFromPublicCityCatalog());
        }

        String normalized = locationName.toLowerCase().trim();
        List<City> all = cityRepository.findAll().stream()
                .filter(c -> !c.isExcludedFromPublicCityCatalog())
                .toList();
        return all.stream()
                .filter(c -> c.getName() != null)
                .filter(c -> {
                    String cn = c.getName().toLowerCase();
                    return cn.contains(normalized) || normalized.contains(cn);
                })
                .findFirst();
    }
}
