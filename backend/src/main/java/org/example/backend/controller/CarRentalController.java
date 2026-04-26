package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.config.AmadeusProperties;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.car.AmadeusCarOfferDto;
import org.example.backend.dto.car.CarBookSimulationRequest;
import org.example.backend.dto.car.CarBookSimulationResponse;
import org.example.backend.service.amadeus.AmadeusCarRentalService;
import org.example.backend.service.car.LocalCarRentalService;
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
 * Car search: Tunisia internal fleet when {@code cityId} is set or {@code location} resolves to a seeded
 * {@code City} (governorate / tourism names via aliases); optional Amadeus transfer-offers when enabled (IATA abroad).
 */
@RestController
@RequestMapping("/api/cars")
@RequiredArgsConstructor
public class CarRentalController {

    private final AmadeusCarRentalService amadeusCarRentalService;
    private final LocalCarRentalService localCarRentalService;
    private final AmadeusProperties amadeusProperties;

    /**
     * Search offers. {@code location}: governorate or city name (aliases e.g. Djerba → Médenine). When {@code cityId}
     * is set, search uses that city directly (must not be a virtual flight-only city).
     */
    @GetMapping("/search")
    public ApiResponse<List<AmadeusCarOfferDto>> search(
            @RequestParam(required = false) Integer cityId,
            @RequestParam(required = false, defaultValue = "") String location,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "1") int passengers) {
        try {
            if (cityId != null) {
                return ApiResponse.success(localCarRentalService.searchByCityId(cityId, startDate, endDate));
            }
            if (location == null || location.isBlank()) {
                throw new IllegalArgumentException("car.error.location_or_city_id");
            }
            var localCity = localCarRentalService.resolveCityForSearch(location);
            if (localCity.isPresent()) {
                return ApiResponse.success(
                        localCarRentalService.searchByCity(localCity.get(), startDate, endDate));
            }
            if (!amadeusProperties.isEnabled()) {
                throw new IllegalStateException("amadeus.disabled");
            }
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
     * Simulated booking: for {@code LOCAL:…} offers persists an internal reservation; otherwise returns a stub ref.
     */
    @PostMapping("/book-simulation")
    public ApiResponse<CarBookSimulationResponse> bookSimulation(@RequestBody CarBookSimulationRequest request) {
        if (request.getOfferId() == null || request.getOfferId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.offer_id");
        }
        if (LocalCarRentalService.isLocalOfferId(request.getOfferId())) {
            return ApiResponse.success(localCarRentalService.bookSimulation(request.getOfferId()));
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
