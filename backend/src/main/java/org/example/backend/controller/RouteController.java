package org.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.RouteResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.repository.CityRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
@Slf4j
public class RouteController {

    private final RestTemplate restTemplate;
    private final CityRepository cityRepository;

    private static final String OSRM_ROUTE =
            "https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson";

    private static final double ROAD_FACTOR = 1.25;
    private static final double PLANE_SPEED_KMH = 600.0;
    private static final double PLANE_OVERHEAD_MIN = 120;
    private static final double BUS_SPEED_KMH = 70.0;
    private static final double DRIVING_SPEED_KMH = 80.0;

    @GetMapping("/calculate")
    public ApiResponse<RouteResponse> calculate(
            @RequestParam int fromCityId,
            @RequestParam int toCityId,
            @RequestParam(defaultValue = "DRIVING") String mode) {

        City from = cityRepository.findById(fromCityId)
                .orElseThrow(() -> new ResourceNotFoundException("api.error.city_not_found"));
        City to = cityRepository.findById(toCityId)
                .orElseThrow(() -> new ResourceNotFoundException("api.error.city_not_found"));

        return switch (mode.toUpperCase()) {
            case "FLIGHT" -> ApiResponse.success(buildFlightRoute(from, to));
            case "TRANSIT" -> ApiResponse.success(buildTransitRoute(from, to));
            default -> ApiResponse.success(buildDrivingRoute(from, to));
        };
    }

    private RouteResponse buildDrivingRoute(City from, City to) {
        try {
            JsonNode osrm = restTemplate.getForObject(
                    OSRM_ROUTE, JsonNode.class,
                    from.getLongitude(), from.getLatitude(),
                    to.getLongitude(), to.getLatitude());

            if (osrm != null && osrm.has("routes") && osrm.get("routes").size() > 0) {
                JsonNode route = osrm.get("routes").get(0);
                double distanceM = route.get("distance").asDouble();
                double durationS = route.get("duration").asDouble();
                JsonNode geometry = route.get("geometry");

                return RouteResponse.builder()
                        .distanceKm(Math.round(distanceM / 1000.0 * 10) / 10.0)
                        .durationMinutes((int) Math.ceil(durationS / 60.0))
                        .mode("DRIVING")
                        .polylineGeoJson(geometry)
                        .segments(List.of(RouteResponse.RouteSegment.builder()
                                .mode("DRIVING")
                                .from(from.getName()).to(to.getName())
                                .distanceKm(Math.round(distanceM / 1000.0 * 10) / 10.0)
                                .durationMin((int) Math.ceil(durationS / 60.0))
                                .fromLat(from.getLatitude()).fromLng(from.getLongitude())
                                .toLat(to.getLatitude()).toLng(to.getLongitude())
                                .build()))
                        .build();
            }
        } catch (Exception e) {
            log.warn("OSRM routing failed, falling back to Haversine: {}", e.getMessage());
        }

        return buildFallbackRoute(from, to, "DRIVING", DRIVING_SPEED_KMH);
    }

    private RouteResponse buildTransitRoute(City from, City to) {
        RouteResponse driving = buildDrivingRoute(from, to);
        double transitDuration = driving.getDurationMinutes() * 1.3;
        return RouteResponse.builder()
                .distanceKm(driving.getDistanceKm())
                .durationMinutes((int) Math.ceil(transitDuration))
                .mode("TRANSIT")
                .polylineGeoJson(driving.getPolylineGeoJson())
                .segments(List.of(RouteResponse.RouteSegment.builder()
                        .mode("BUS")
                        .from(from.getName()).to(to.getName())
                        .distanceKm(driving.getDistanceKm())
                        .durationMin((int) Math.ceil(transitDuration))
                        .fromLat(from.getLatitude()).fromLng(from.getLongitude())
                        .toLat(to.getLatitude()).toLng(to.getLongitude())
                        .build()))
                .build();
    }

    private RouteResponse buildFlightRoute(City from, City to) {
        double aerialKm = haversine(from.getLatitude(), from.getLongitude(),
                to.getLatitude(), to.getLongitude());
        int flightMin = (int) Math.ceil(aerialKm / PLANE_SPEED_KMH * 60);
        int totalMin = (int) (flightMin + PLANE_OVERHEAD_MIN);

        Map<String, Object> straightLine = Map.of(
                "type", "LineString",
                "coordinates", List.of(
                        List.of(from.getLongitude(), from.getLatitude()),
                        List.of(to.getLongitude(), to.getLatitude())
                )
        );

        List<RouteResponse.RouteSegment> segments = new ArrayList<>();

        segments.add(RouteResponse.RouteSegment.builder()
                .mode("TAXI_TRANSFER")
                .from(from.getName()).to(from.getName() + " Airport")
                .distanceKm(15).durationMin(25)
                .fromLat(from.getLatitude()).fromLng(from.getLongitude())
                .toLat(from.getLatitude()).toLng(from.getLongitude())
                .build());

        segments.add(RouteResponse.RouteSegment.builder()
                .mode("FLIGHT")
                .from(from.getName() + " Airport").to(to.getName() + " Airport")
                .distanceKm(Math.round(aerialKm * 10) / 10.0)
                .durationMin(flightMin)
                .fromLat(from.getLatitude()).fromLng(from.getLongitude())
                .toLat(to.getLatitude()).toLng(to.getLongitude())
                .build());

        segments.add(RouteResponse.RouteSegment.builder()
                .mode("TAXI_TRANSFER")
                .from(to.getName() + " Airport").to(to.getName())
                .distanceKm(12).durationMin(20)
                .fromLat(to.getLatitude()).fromLng(to.getLongitude())
                .toLat(to.getLatitude()).toLng(to.getLongitude())
                .build());

        return RouteResponse.builder()
                .distanceKm(Math.round(aerialKm * 10) / 10.0)
                .durationMinutes(totalMin)
                .mode("FLIGHT")
                .polylineGeoJson(straightLine)
                .segments(segments)
                .build();
    }

    private RouteResponse buildFallbackRoute(City from, City to, String mode, double speedKmh) {
        double aerialKm = haversine(from.getLatitude(), from.getLongitude(),
                to.getLatitude(), to.getLongitude());
        double roadKm = Math.round(aerialKm * ROAD_FACTOR * 10) / 10.0;
        int durationMin = (int) Math.ceil(roadKm / speedKmh * 60);

        Map<String, Object> line = Map.of(
                "type", "LineString",
                "coordinates", List.of(
                        List.of(from.getLongitude(), from.getLatitude()),
                        List.of(to.getLongitude(), to.getLatitude())
                )
        );

        return RouteResponse.builder()
                .distanceKm(roadKm)
                .durationMinutes(durationMin)
                .mode(mode)
                .polylineGeoJson(line)
                .segments(List.of(RouteResponse.RouteSegment.builder()
                        .mode(mode)
                        .from(from.getName()).to(to.getName())
                        .distanceKm(roadKm).durationMin(durationMin)
                        .fromLat(from.getLatitude()).fromLng(from.getLongitude())
                        .toLat(to.getLatitude()).toLng(to.getLongitude())
                        .build()))
                .build();
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
