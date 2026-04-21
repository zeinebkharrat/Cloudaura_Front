package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.flight.AirportResolveResponse;
import org.example.backend.dto.flight.FlightDto;
import org.example.backend.dto.flight.FlightSuggestionResponse;
import org.example.backend.service.flight.AviationStackFlightService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public read-only API: live flight data is fetched server-side from Aviationstack (never from the browser).
 */
@RestController
@RequestMapping("/api/flights")
@RequiredArgsConstructor
public class FlightController {

    private final AviationStackFlightService flightService;

    /**
     * Sample of flights for the current UTC date (provider-dependent; cached briefly).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<FlightDto>>> getAll(
            @RequestParam(name = "limit", required = false) Integer limit) {
        int lim = limit == null ? 0 : limit;
        List<FlightDto> data = flightService.getAllFlights(lim);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * Route search: IATA codes, e.g. {@code /api/flights/search?dep=TUN&arr=CDG}.
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<FlightDto>>> searchByRoute(
            @RequestParam("dep") String depIata,
            @RequestParam("arr") String arrIata,
            @RequestParam(name = "limit", required = false) Integer limit) {
        int lim = limit == null ? 0 : limit;
        List<FlightDto> data = flightService.getFlightsByRoute(depIata, arrIata, lim);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * Smart suggestion: from an origin airport (default TUN) toward a city name or destination IATA.
     */
    @GetMapping("/suggest-for-destination")
    public ResponseEntity<ApiResponse<FlightSuggestionResponse>> suggestForDestination(
            @RequestParam("destination") String destination,
            @RequestParam(name = "origin", required = false, defaultValue = "TUN") String originIata,
            @RequestParam(name = "limit", required = false) Integer limit) {
        int lim = limit == null ? 0 : limit;
        FlightSuggestionResponse data = flightService.suggestForDestination(originIata, destination, lim);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * Resolve a free-text destination to a main airport (demo rules; extend with geocoding later).
     */
    @GetMapping("/resolve-airport")
    public ResponseEntity<ApiResponse<AirportResolveResponse>> resolveAirport(
            @RequestParam("q") String query) {
        return ResponseEntity.ok(ApiResponse.success(flightService.resolveAirportQuery(query)));
    }
}
