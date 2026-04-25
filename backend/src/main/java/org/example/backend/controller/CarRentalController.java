package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.car.AmadeusCarOfferDto;
import org.example.backend.dto.car.CarBookSimulationRequest;
import org.example.backend.dto.car.CarBookSimulationResponse;
import org.example.backend.service.amadeus.AmadeusCarRentalService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Yalla TN car / private-transfer search via Amadeus (Self-Service).
 * <p>
 * {@code GET /api/cars/search} wraps Amadeus {@code POST /v1/shopping/transfer-offers}.
 * </p>
 */
@RestController
@RequestMapping("/api/cars")
@RequiredArgsConstructor
public class CarRentalController {

    private final AmadeusCarRentalService amadeusCarRentalService;

    /**
     * Search offers. Query {@code location} must be a 3-letter IATA airport code (e.g. TUN, CDG).
     */
    @GetMapping("/search")
    public ApiResponse<List<AmadeusCarOfferDto>> search(
            @RequestParam String location,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "1") int passengers) {
        try {
            return ApiResponse.success(
                    amadeusCarRentalService.searchCars(location, startDate, endDate, passengers));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        } catch (WebClientResponseException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "amadeus.upstream_" + e.getStatusCode().value());
        }
    }

    /**
     * Simulated booking: returns a confirmation reference without calling Amadeus Transfer Booking.
     */
    @PostMapping("/book-simulation")
    public ApiResponse<CarBookSimulationResponse> bookSimulation(@RequestBody CarBookSimulationRequest request) {
        if (request.getOfferId() == null || request.getOfferId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.offer_id");
        }
        String ref = "YTN-CAR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        CarBookSimulationResponse body = CarBookSimulationResponse.builder()
                .simulated(true)
                .confirmationRef(ref)
                .offerId(request.getOfferId().trim())
                .message("Simulation: no Amadeus transfer order created.")
                .build();
        return ApiResponse.success(body);
    }
}
