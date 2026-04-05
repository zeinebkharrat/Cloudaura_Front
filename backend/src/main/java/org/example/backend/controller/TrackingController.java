package org.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.TrackingSimulationService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tracking")
@RequiredArgsConstructor
@Slf4j
public class TrackingController {

    private final TrackingSimulationService trackingService;
    private final TransportReservationRepository reservationRepo;
    private final RestTemplate restTemplate;

    private static final String OSRM_ROUTE =
            "https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson";

    @PostMapping("/{reservationId}/start")
    public ApiResponse<Map<String, Object>> startTracking(@PathVariable int reservationId) {
        if (trackingService.isSimulating(reservationId)) {
            return ApiResponse.success(Map.of("message", "Simulation déjà en cours", "reservationId", reservationId));
        }

        TransportReservation res = reservationRepo.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));

        City from = res.getTransport().getDepartureCity();
        City to = res.getTransport().getArrivalCity();

        List<List<Double>> coordinates = fetchRouteCoordinates(from, to);
        List<List<Double>> sampled = sampleCoordinates(coordinates, 100);

        trackingService.startSimulation(reservationId, sampled);

        return ApiResponse.success(Map.of(
                "message", "Simulation démarrée",
                "reservationId", reservationId,
                "totalPoints", sampled.size()
        ));
    }

    @PostMapping("/{reservationId}/stop")
    public ApiResponse<Map<String, Object>> stopTracking(@PathVariable int reservationId) {
        trackingService.stopSimulation(reservationId);
        return ApiResponse.success(Map.of("message", "Simulation arrêtée", "reservationId", reservationId));
    }

    private List<List<Double>> fetchRouteCoordinates(City from, City to) {
        try {
            JsonNode osrm = restTemplate.getForObject(OSRM_ROUTE, JsonNode.class,
                    from.getLongitude(), from.getLatitude(),
                    to.getLongitude(), to.getLatitude());

            if (osrm != null && osrm.has("routes") && osrm.get("routes").size() > 0) {
                JsonNode coords = osrm.get("routes").get(0).get("geometry").get("coordinates");
                List<List<Double>> result = new ArrayList<>();
                for (JsonNode coord : coords) {
                    result.add(List.of(coord.get(0).asDouble(), coord.get(1).asDouble()));
                }
                return result;
            }
        } catch (Exception e) {
            log.warn("OSRM failed for tracking, using straight line: {}", e.getMessage());
        }

        return List.of(
                List.of(from.getLongitude(), from.getLatitude()),
                List.of(to.getLongitude(), to.getLatitude())
        );
    }

    /**
     * Reduce coordinate list to at most maxPoints evenly spaced samples.
     */
    private List<List<Double>> sampleCoordinates(List<List<Double>> coords, int maxPoints) {
        if (coords.size() <= maxPoints) return coords;
        List<List<Double>> sampled = new ArrayList<>();
        double step = (double) (coords.size() - 1) / (maxPoints - 1);
        for (int i = 0; i < maxPoints; i++) {
            sampled.add(coords.get((int) Math.round(i * step)));
        }
        return sampled;
    }
}
