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

        double baseFactor = Math.abs(from.getCityId() - to.getCityId()) * 1.5;
        double distFactor = Math.max(1.0, baseFactor);
        int durationMinutes = (int) (distFactor * 45);

        Transport taxi = createMockTransport(from, to, date.atTime(10, 0), Transport.TransportType.TAXI, 25.0 * distFactor, 4, durationMinutes);
        generated.add(taxi);

        Transport bus1 = createMockTransport(from, to, date.atTime(8, 0), Transport.TransportType.BUS, 15.0 * distFactor, 45, durationMinutes);
        Transport bus2 = createMockTransport(from, to, date.atTime(15, 0), Transport.TransportType.BUS, 15.0 * distFactor, 45, durationMinutes);
        generated.add(bus1);
        generated.add(bus2);

        if (from.getHasAirport() != null && from.getHasAirport() && to.getHasAirport() != null && to.getHasAirport()) {
            Transport plane = createMockTransport(from, to, date.atTime(11, 30), Transport.TransportType.PLANE, 120.0 * distFactor, 150, Math.max(45, durationMinutes / 3));
            plane.setOperatorName("Tunisair");
            plane.setFlightCode("TU-100");
            generated.add(plane);
        }

        return generated;
    }

    private Transport createMockTransport(City from, City to, LocalDateTime departure, Transport.TransportType type, double price, int capacity, int durationMinutes) {
        return Transport.builder()
                .departureCity(from)
                .arrivalCity(to)
                .departureTime(departure)
                .arrivalTime(departure.plusMinutes(durationMinutes))
                .type(type)
                .price((double) Math.round(price * 100) / 100)
                .capacity(capacity)
                .isActive(true)
                .build();
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

        return TransportSearchResponse.builder()
                .transportId(t.getTransportId())
                .type(t.getType().name())
                .departureCityName(catalogTranslationService.resolve("city." + depId + ".name", lang, t.getDepartureCity().getName()))
                .arrivalCityName(catalogTranslationService.resolve("city." + arrId + ".name", lang, t.getArrivalCity().getName()))
                .departureTime(t.getDepartureTime())
                .arrivalTime(t.getArrivalTime())
                .price(t.getPrice())
                .capacity(t.getCapacity())
                .availableSeats(available)
                .durationMinutes((int) Duration.between(t.getDepartureTime(), t.getArrivalTime()).toMinutes())
                .isActive(t.getIsActive())
                .build();
    }
}
