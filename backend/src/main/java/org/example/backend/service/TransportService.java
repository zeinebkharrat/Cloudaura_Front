package org.example.backend.service;

import org.example.backend.dto.transport.TransportSearchRequest;
import org.example.backend.dto.transport.TransportSearchResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransportService {
    private final TransportRepository transportRepository;
    private final TransportReservationRepository reservationRepository;
    private final CityRepository cityRepository;
    private final CatalogTranslationService catalogTranslationService;
    private final TransportPricingService transportPricingService;

    @Transactional
    public List<TransportSearchResponse> searchTransports(TransportSearchRequest request, String lang) {
        if (request.getTravelDate() == null) {
            request.setTravelDate(LocalDate.now());
        }

        cityRepository.findById(request.getDepartureCityId())
                .orElseThrow(() -> new ResourceNotFoundException("api.error.city_not_found"));
        cityRepository.findById(request.getArrivalCityId())
                .orElseThrow(() -> new ResourceNotFoundException("api.error.city_not_found"));

        List<Transport> transports = transportRepository.findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
                request.getDepartureCityId(),
                request.getArrivalCityId(),
                request.getTravelDate().atStartOfDay(),
                request.getTravelDate().atTime(23, 59, 59));

        if (transports.isEmpty()) {
            City from = cityRepository.findById(request.getDepartureCityId()).orElseThrow();
            City to = cityRepository.findById(request.getArrivalCityId()).orElseThrow();
            transports = generateDailyTransports(from, to, request.getTravelDate());
            if (!transports.isEmpty()) {
                transports = transportRepository.saveAll(transports);
            }
        }

        return transports.stream()
                .filter(t -> request.getType() == null || request.getType().equalsIgnoreCase("ALL") || request.getType().isEmpty() || t.getType().name().equalsIgnoreCase(request.getType()))
                .map(t -> mapToResponse(t, lang))
                .filter(t -> t.getAvailableSeats() >= request.getNumberOfPassengers())
                .collect(Collectors.toList());
    }

    private List<Transport> generateDailyTransports(City from, City to, LocalDate date) {
        List<Transport> generated = new ArrayList<>();

        double distanceKm = estimateDistanceKm(from, to);
        int taxiDurationMinutes = estimateDurationMinutes(distanceKm, 52.0, 8);
        int busDurationMinutes = estimateDurationMinutes(distanceKm, 60.0, 20);

        double taxiPrice = transportPricingService.estimateTaxiUnitFareTnd(distanceKm, taxiDurationMinutes);
        double busPrice = transportPricingService.estimateBusUnitFareTnd(distanceKm);

        Transport taxi = createMockTransport(
            from,
            to,
            date.atTime(10, 0),
            Transport.TransportType.TAXI,
            taxiPrice,
            4,
            taxiDurationMinutes,
            String.format(
                    "Tarif taxi estimatif %.0f km: %.2f TND de prise en charge + %.2f TND/km + %.2f TND/min (majoration nuit possible).",
                    distanceKm,
                    TransportPricingService.TAXI_BASE_FARE_TND,
                    TransportPricingService.TAXI_PER_KM_TND,
                    TransportPricingService.TAXI_PER_MIN_TND));
        generated.add(taxi);

        Transport bus1 = createMockTransport(
            from,
            to,
            date.atTime(8, 0),
            Transport.TransportType.BUS,
            busPrice,
            45,
            busDurationMinutes,
                String.format(
                    "Tarif bus estimatif %.0f km: %.2f TND/km par passager. Prix indicatif.",
                    distanceKm,
                    TransportPricingService.BUS_INTERCITY_PER_KM_TND));
        Transport bus2 = createMockTransport(
            from,
            to,
            date.atTime(15, 0),
            Transport.TransportType.BUS,
            busPrice,
            45,
            busDurationMinutes,
                String.format(
                    "Tarif bus estimatif %.0f km: %.2f TND/km par passager. Prix indicatif.",
                    distanceKm,
                    TransportPricingService.BUS_INTERCITY_PER_KM_TND));
        generated.add(bus1);
        generated.add(bus2);

        if (from.getHasAirport() != null && from.getHasAirport() && to.getHasAirport() != null && to.getHasAirport()) {
            double planePrice = round2(Math.max(95.0, (distanceKm * 0.55) + 35.0));
            int planeDuration = Math.max(45, estimateDurationMinutes(distanceKm, 540.0, 75));
            Transport plane = createMockTransport(
                from,
                to,
                date.atTime(11, 30),
                Transport.TransportType.PLANE,
                planePrice,
                150,
                planeDuration,
                String.format("Tarif avion indicatif %.0f km: base aéroport + distance.", distanceKm));
            plane.setOperatorName("Tunisair");
            plane.setFlightCode("TU-100");
            generated.add(plane);
        }

        return generated;
    }

    private Transport createMockTransport(
            City from,
            City to,
            LocalDateTime departure,
            Transport.TransportType type,
            double price,
            int capacity,
            int durationMinutes,
            String description) {
        return Transport.builder()
                .departureCity(from)
                .arrivalCity(to)
                .departureTime(departure)
                .arrivalTime(departure.plusMinutes(durationMinutes))
                .type(type)
                .price((double) Math.round(price * 100) / 100)
                .capacity(capacity)
                .description(description)
                .isActive(true)
                .build();
    }

    private int estimateDurationMinutes(double distanceKm, double avgSpeedKmH, int overheadMinutes) {
        double driveMinutes = (distanceKm / Math.max(1.0, avgSpeedKmH)) * 60.0;
        return Math.max(20, (int) Math.round(driveMinutes + overheadMinutes));
    }

    private double estimateDistanceKm(City from, City to) {
        if (from.getLatitude() != null && from.getLongitude() != null
                && to.getLatitude() != null && to.getLongitude() != null) {
            double aerial = haversineKm(from.getLatitude(), from.getLongitude(), to.getLatitude(), to.getLongitude());
            // Road distance is generally higher than aerial distance.
            return Math.max(3.0, aerial * 1.22);
        }
        return Math.max(3.0, Math.abs(from.getCityId() - to.getCityId()) * 28.0);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return r * c;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    @Transactional(readOnly = true)
    public TransportSearchResponse getTransportById(int id, String lang) {
        Transport transport = transportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.transport_not_found"));
        if (!transport.getIsActive()) {
            throw new ResourceNotFoundException("reservation.error.transport_inactive");
        }
        return mapToResponse(transport, lang);
    }

    private TransportSearchResponse mapToResponse(Transport t, String lang) {
        int booked = reservationRepository.countBookedSeats(t.getTransportId());
        int available = t.getCapacity() - booked;
        int depId = t.getDepartureCity().getCityId();
        int arrId = t.getArrivalCity().getCityId();
        int durationMinutes = (int) Duration.between(t.getDepartureTime(), t.getArrivalTime()).toMinutes();
        double distanceKm = estimateDistanceKm(t.getDepartureCity(), t.getArrivalCity());

        double displayPrice = t.getPrice() != null ? t.getPrice() : 0.0;
        if (t.getType() == Transport.TransportType.TAXI) {
            int pricingDurationMin = estimateTaxiRouteDurationMinutes(distanceKm);
            displayPrice = transportPricingService.estimateTaxiTotalTnd(
                    distanceKm,
                    pricingDurationMin,
                    transportPricingService.isNightTrip(t.getDepartureTime()),
                    false,
                    0);
        }
        if (t.getType() == Transport.TransportType.BUS) {
            double baseline = transportPricingService.estimateBusUnitFareTnd(distanceKm);
            // Guard against bad seeded or stale fares while still allowing operator-specific prices.
            if (displayPrice <= 0 || displayPrice > baseline * 3.0) {
                displayPrice = baseline;
            }
        }

        return TransportSearchResponse.builder()
                .transportId(t.getTransportId())
                .type(t.getType().name())
                .departureCityName(catalogTranslationService.resolve("city." + depId + ".name", lang, t.getDepartureCity().getName()))
                .arrivalCityName(catalogTranslationService.resolve("city." + arrId + ".name", lang, t.getArrivalCity().getName()))
                .departureTime(t.getDepartureTime())
                .arrivalTime(t.getArrivalTime())
                .price(round2(displayPrice))
                .capacity(t.getCapacity())
                .availableSeats(available)
                .durationMinutes(durationMinutes)
                .isActive(t.getIsActive())
                .build();
    }

    private int estimateTaxiRouteDurationMinutes(double distanceKm) {
        // Results list should stay close to booking/map reality (no extra overhead here).
        return Math.max(3, (int) Math.round((Math.max(0.0, distanceKm) / 45.0) * 60.0));
    }
}
