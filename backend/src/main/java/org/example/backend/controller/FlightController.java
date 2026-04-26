package org.example.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.flight.AircraftTrackResponse;
import org.example.backend.dto.flight.AirportResolveResponse;
import org.example.backend.dto.flight.FlightDto;
import org.example.backend.dto.flight.FlightSuggestionResponse;
import org.example.backend.service.flight.AircraftPositionService;
import org.example.backend.service.flight.AviationStackFlightService;
import org.example.backend.service.flight.FlightTrackRateLimitService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Public read-only API: live flight data is fetched server-side from Aviationstack (never from the browser).
 */
@RestController
@RequestMapping("/api/flights")
@RequiredArgsConstructor
public class FlightController {

    private static final Pattern FLIGHT_QUERY_ALLOWED = Pattern.compile("^[A-Za-z]{2}\\s*\\d{1,4}$|^\\d{1,4}$");
    private static final Pattern ICAO24_PATH = Pattern.compile("^[a-fA-F0-9]{4,6}$");

    private final AviationStackFlightService flightService;
    private final AircraftPositionService aircraftPositionService;
    private final FlightTrackRateLimitService flightTrackRateLimitService;

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
     * Lookup by flight IATA (e.g. {@code TU712}) or numeric flight number (e.g. {@code 712}) for a UTC date.
     * Optional {@code date} in {@code yyyy-MM-dd}; defaults to today UTC on the server.
     */
    @GetMapping("/by-flight")
    public ResponseEntity<ApiResponse<List<FlightDto>>> searchByFlight(
            @RequestParam("flight") String flight,
            @RequestParam(name = "date", required = false) String flightDate,
            @RequestParam(name = "limit", required = false) Integer limit) {
        String q = flight == null ? "" : flight.trim();
        if (q.isEmpty() || !FLIGHT_QUERY_ALLOWED.matcher(q).matches()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(
                            "Invalid flight: use airline code + number (e.g. TU712) or 1–4 digits.",
                            "flight.invalid_query",
                            HttpStatus.BAD_REQUEST.value()));
        }
        int lim = limit == null ? 0 : limit;
        List<FlightDto> data = flightService.getFlightsByFlightQuery(q, flightDate, lim);
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

    /**
     * Live ADS-B position (OpenSky). Either {@code icao24} or {@code flight} must be set.
     * With {@code flight}, optional {@code date} ({@code yyyy-MM-dd}), {@code dep}, {@code arr} IATA codes help resolve ICAO24.
     */
    @GetMapping("/track")
    public ResponseEntity<ApiResponse<AircraftTrackResponse>> track(
            HttpServletRequest httpRequest,
            @RequestParam(name = "icao24", required = false) String icao24,
            @RequestParam(name = "flight", required = false) String flight,
            @RequestParam(name = "date", required = false) String date,
            @RequestParam(name = "dep", required = false) String dep,
            @RequestParam(name = "arr", required = false) String arr) {
        if (!flightTrackRateLimitService.allow(clientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error(
                            "Too many live track requests. Please wait a moment.",
                            "flight.track_rate_limit",
                            HttpStatus.TOO_MANY_REQUESTS.value()));
        }
        boolean hasIcao = icao24 != null && !icao24.isBlank();
        boolean hasFlight = flight != null && !flight.isBlank();
        if (!hasIcao && !hasFlight) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(
                            "Provide icao24 or flight (and optional date, dep, arr).",
                            "flight.track_bad_request",
                            HttpStatus.BAD_REQUEST.value()));
        }
        if (hasIcao) {
            AircraftTrackResponse data = aircraftPositionService.trackByIcao24(icao24);
            return ResponseEntity.ok(ApiResponse.success(data));
        }
        String fq = flight.trim();
        if (!FLIGHT_QUERY_ALLOWED.matcher(fq).matches()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(
                            "Invalid flight: use airline code + number (e.g. TU712) or 1–4 digits.",
                            "flight.invalid_query",
                            HttpStatus.BAD_REQUEST.value()));
        }
        AircraftTrackResponse data = aircraftPositionService.trackByFlightQuery(fq, date, dep, arr);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @GetMapping("/track/{icao24}")
    public ResponseEntity<ApiResponse<AircraftTrackResponse>> trackByIcaoPath(
            HttpServletRequest httpRequest,
            @PathVariable("icao24") String icao24) {
        if (!flightTrackRateLimitService.allow(clientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error(
                            "Too many live track requests. Please wait a moment.",
                            "flight.track_rate_limit",
                            HttpStatus.TOO_MANY_REQUESTS.value()));
        }
        String raw = icao24 == null ? "" : icao24.trim();
        if (!ICAO24_PATH.matcher(raw).matches()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(
                            "Invalid icao24 (4–6 hex characters).",
                            "flight.invalid_icao24",
                            HttpStatus.BAD_REQUEST.value()));
        }
        return ResponseEntity.ok(ApiResponse.success(aircraftPositionService.trackByIcao24(raw)));
    }

    private static String clientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return Optional.ofNullable(req.getRemoteAddr()).orElse("unknown");
    }
}
