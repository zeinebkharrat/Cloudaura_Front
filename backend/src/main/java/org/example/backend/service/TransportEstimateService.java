package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.transport.TransportEstimateRequest;
import org.example.backend.dto.transport.TransportEstimateResponse;
import org.example.backend.model.Distance;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportAdvisoryCalendar;
import org.example.backend.model.TransportQuoteRequest;
import org.example.backend.repository.DistanceRepository;
import org.example.backend.repository.TransportAdvisoryCalendarRepository;
import org.example.backend.repository.TransportQuoteRequestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TransportEstimateService {

    private final TransportPricingService transportPricingService;
    private final DistanceRepository distanceRepository;
    private final TransportAdvisoryCalendarRepository advisoryRepository;
    private final TransportQuoteRequestRepository quoteRepository;

    @Transactional
    public TransportEstimateResponse estimate(TransportEstimateRequest req) {
        if (req.getTransportType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transport.error.type_required");
        }
        if (req.getDepartureCityId() == null || req.getArrivalCityId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transport.error.route_required");
        }
        if (req.getDepartureCityId().equals(req.getArrivalCityId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transport.error.same_city_route");
        }

        int safeSeats = req.getSeats() != null && req.getSeats() > 0 ? req.getSeats() : 1;
        LocalDate travelDate = req.getTravelDate() != null ? req.getTravelDate() : LocalDate.now();
        LocalDateTime travelDateTime = travelDate.atStartOfDay();

        double km = resolveKm(req);
        int durationMin = req.getRouteDurationMin() != null && req.getRouteDurationMin() > 0
                ? req.getRouteDurationMin()
                : 0;

        Transport synthetic = Transport.builder()
                .type(req.getTransportType())
                .price(defaultUnitPrice(req.getTransportType()))
                .build();

        double base = transportPricingService.computeTotalTnd(
                synthetic,
                safeSeats,
                km,
                durationMin > 0 ? durationMin : null,
                req.getRentalDays(),
                travelDateTime);

        List<TransportAdvisoryCalendar> advisories = advisoryRepository
                .findActiveByTypeAndTravelDate(req.getTransportType(), travelDate);
        TransportAdvisoryCalendar advisory = advisories.isEmpty() ? null : advisories.get(0);

        double min = base;
        double max = base;
        boolean advisoryApplied = false;
        String demand = "MEDIUM";
        String availability = "NORMAL";
        boolean reducedAvailability = false;
        boolean possibleHigherPrice = false;
        String advisoryMessage = null;

        if (advisory != null) {
            advisoryApplied = true;
            min = round2(base * advisory.getPriceMultiplierMin().doubleValue());
            max = round2(base * advisory.getPriceMultiplierMax().doubleValue());
            demand = advisory.getDemandLevel().name();
            availability = advisory.getAvailabilityLevel().name();
            reducedAvailability = advisory.getAvailabilityLevel() != TransportAdvisoryCalendar.AvailabilityLevel.NORMAL;
            possibleHigherPrice = advisory.getPriceMultiplierMax().doubleValue() > 1.0;
            advisoryMessage = advisory.getAdvisoryMessage();
        }

        TransportQuoteRequest quote = TransportQuoteRequest.builder()
                .userId(req.getUserId())
                .transportType(req.getTransportType())
                .departureCityId(req.getDepartureCityId())
                .arrivalCityId(req.getArrivalCityId())
                .travelDate(travelDate)
                .seats(safeSeats)
                .routeKm(toDecimal(km))
                .routeDurationMin(durationMin > 0 ? durationMin : null)
                .estimatedPriceBase(toDecimal(base))
                .estimatedPriceMin(toDecimal(min))
                .estimatedPriceMax(toDecimal(max))
                .currency("TND")
                .advisoryApplied(advisoryApplied)
                .advisory(advisory)
                .createdAt(LocalDateTime.now())
                .build();
        quoteRepository.save(quote);

        return TransportEstimateResponse.builder()
                .transportType(req.getTransportType().name())
                .departureCityId(req.getDepartureCityId())
                .arrivalCityId(req.getArrivalCityId())
                .travelDate(travelDate)
                .seats(safeSeats)
                .routeKm(round2(km))
                .routeDurationMin(durationMin > 0 ? durationMin : null)
                .referencePriceTnd(base)
                .minPriceTnd(min)
                .maxPriceTnd(max)
                .currency("TND")
                .advisoryApplied(advisoryApplied)
                .demandLevel(demand)
                .availabilityLevel(availability)
                .reducedAvailability(reducedAvailability)
                .possibleHigherPrice(possibleHigherPrice)
                .advisoryMessage(advisoryMessage)
                .build();
    }

    private double resolveKm(TransportEstimateRequest req) {
        if (req.getRouteKm() != null && req.getRouteKm() > 0) {
            return req.getRouteKm();
        }
        Optional<Distance> d = distanceRepository.findByFromCity_CityIdAndToCity_CityId(
                req.getDepartureCityId(), req.getArrivalCityId());
        if (d.isPresent() && d.get().getDistanceKm() != null && d.get().getDistanceKm() > 0) {
            return d.get().getDistanceKm();
        }

        Optional<Distance> rev = distanceRepository.findByFromCity_CityIdAndToCity_CityId(
                req.getArrivalCityId(), req.getDepartureCityId());
        if (rev.isPresent() && rev.get().getDistanceKm() != null && rev.get().getDistanceKm() > 0) {
            return rev.get().getDistanceKm();
        }
        return 0.0;
    }

    private static double defaultUnitPrice(Transport.TransportType type) {
        return switch (type) {
            case CAR -> 52.0;
            case BUS -> 4.0;
            case TAXI -> 0.0;
            case PLANE -> 120.0;
            case TRAIN -> 18.0;
            case FERRY -> 25.0;
            case VAN -> 12.0;
        };
    }

    private static BigDecimal toDecimal(double value) {
        return BigDecimal.valueOf(round2(value));
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
