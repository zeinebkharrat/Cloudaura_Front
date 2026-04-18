package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.flight.AirportResolveResponse;
import org.example.backend.dto.flight.FlightBookingRequest;
import org.example.backend.dto.flight.FlightBookingResponse;
import org.example.backend.dto.flight.FlightOfferDto;
import org.example.backend.dto.flight.FlightSuggestionResponse;
import org.example.backend.service.flight.DuffelFlightService;
import org.example.backend.service.flight.FlightValidationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/flights")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class FlightController {

    private final DuffelFlightService flightService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FlightOfferDto>>> getAll(
            @RequestParam(name = "limit", required = false) Integer limit) {
        List<FlightOfferDto> data = Collections.emptyList();
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<FlightOfferDto>>> searchByRoute(
            @RequestParam("dep") String depIata,
            @RequestParam(name = "arr", required = false) String arrIata,
            @RequestParam(name = "date", required = false) String departureDate,
            @RequestParam(name = "adults", required = false) Integer adults,
            @RequestParam(name = "cabinClass", required = false) String cabinClass,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "limit", required = false) Integer limit) {
        String normalizedType = normalizeFlightType(type);
        String dep = normalizeIataOrThrow(depIata, "dep");
        String arr = normalizeArrForSearch(arrIata, normalizedType);

        int lim = limit == null ? 0 : limit;
        int pax = adults == null ? 1 : adults;
        LocalDate date = parseDateOrDefault(departureDate);
        List<FlightOfferDto> data = flightService.searchFlights(dep, arr, date, pax, cabinClass, lim, normalizedType);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @GetMapping("/offers/{id}")
    public ResponseEntity<ApiResponse<FlightOfferDto>> getOfferById(@PathVariable("id") String id) {
        return ResponseEntity.ok(ApiResponse.success(flightService.getOfferById(id)));
    }

    @PostMapping("/book")
    public ResponseEntity<ApiResponse<FlightBookingResponse>> bookFlight(
            @Valid @RequestBody FlightBookingRequest request) {
        return ResponseEntity.ok(ApiResponse.success(flightService.createOrder(request)));
    }

    @GetMapping("/suggest-for-destination")
    public ResponseEntity<ApiResponse<FlightSuggestionResponse>> suggestForDestination(
            @RequestParam("destination") String destination,
            @RequestParam(name = "origin", required = false) String originIata,
            @RequestParam(name = "limit", required = false) Integer limit) {
        int lim = limit == null ? 0 : limit;
        FlightSuggestionResponse data = flightService.suggestForDestination(originIata, destination, lim);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @GetMapping("/resolve-airport")
    public ResponseEntity<ApiResponse<AirportResolveResponse>> resolveAirport(
            @RequestParam("q") String query) {
        return ResponseEntity.ok(ApiResponse.success(flightService.resolveAirportQuery(query)));
    }

    private LocalDate parseDateOrDefault(String departureDate) {
        if (departureDate == null || departureDate.isBlank()) {
            return LocalDate.now().plusDays(14);
        }
        try {
            return LocalDate.parse(departureDate.trim());
        } catch (DateTimeParseException ex) {
            return LocalDate.now().plusDays(14);
        }
    }

    private String normalizeFlightType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        if (!"internal".equals(normalized) && !"external".equals(normalized)) {
            throw new FlightValidationException(
                    "api.error.flight.validation.type",
                    "type must be one of: internal, external");
        }
        return normalized;
    }

    private String normalizeArrForSearch(String arrIata, String type) {
        if (arrIata == null || arrIata.isBlank()) {
            if ("external".equals(type)) {
                return "TUN";
            }
            throw new FlightValidationException(
                    "api.error.flight.validation.arr_required",
                    "arr is required for flight search");
        }
        return normalizeIataOrThrow(arrIata, "arr");
    }

    private String normalizeIataOrThrow(String code, String fieldName) {
        if (code == null || code.isBlank()) {
            throw new FlightValidationException(
                    "api.error.flight.validation.iata",
                    fieldName + " must be a valid IATA code (3 letters)");
        }
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        if (!isValidIata(normalized)) {
            throw new FlightValidationException(
                    "api.error.flight.validation.iata",
                    fieldName + " must be a valid IATA code (3 letters)");
        }
        return normalized;
    }

    private boolean isValidIata(String code) {
        return code != null && code.length() == 3 && code.chars().allMatch(Character::isLetter);
    }
}
