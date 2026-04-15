package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.exception.InvalidTransportException;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.TransportReservationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminTransportController {

    private final TransportRepository transportRepository;
    private final CityRepository cityRepository;
    private final TransportReservationRepository reservationRepository;
    private final TransportReservationService transportReservationService;

    // ==================== STATS ====================

    @GetMapping("/transports/stats")
    @Transactional(readOnly = true)
    public ApiResponse<TransportStatsDTO> getStats() {
        long total   = transportRepository.count();
        long active  = transportRepository.countActive();

        List<Transport> activeTransports = transportRepository.findByIsActiveTrue();
        long availableSeats = activeTransports.stream()
            .mapToLong(t -> {
                long booked = countBookedSeatsFor(t.getTransportId());
                int cap = t.getCapacity() != null ? t.getCapacity() : 0;
                return Math.max(0, cap - booked);
            })
            .sum();

        long todayReservations = reservationRepository.countTodayConfirmed();

        return ApiResponse.success(new TransportStatsDTO(
            total, active, availableSeats, todayReservations
        ));
    }

    // ==================== TRANSPORT QUERIES (literal paths before /transports/{id}) ====================

    @GetMapping("/transports/available-types")
    @Transactional(readOnly = true)
    public ApiResponse<List<TransportTypeAvailabilityDTO>> getAvailableTypes(
            @RequestParam Integer departureCityId,
            @RequestParam Integer arrivalCityId) {

        City dep = cityRepository.findById(departureCityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_departure_city_not_found"));
        City arr = cityRepository.findById(arrivalCityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_arrival_city_not_found"));

        List<TransportTypeAvailabilityDTO> result = new ArrayList<>();

        result.add(checkType("PLANE", "Avion", dep, arr));
        result.add(checkType("BUS", "Bus", dep, arr));
        result.add(checkType("VAN", "Van / Louage", dep, arr));
        result.add(checkType("TAXI", "Taxi", dep, arr));
        result.add(checkType("CAR", "Voiture", dep, arr));

        return ApiResponse.success(result);
    }

    @GetMapping("/transports")
    @Transactional(readOnly = true)
    public ApiResponse<List<TransportDTO>> getAllTransports() {
        List<Transport> transports = transportRepository.findAll();
        List<TransportDTO> dtos = transports.stream()
            .map(t -> toTransportDTO(t, countBookedSeatsFor(t.getTransportId())))
            .toList();
        return ApiResponse.success(dtos);
    }

    @GetMapping("/transports/{id}/reservations")
    @Transactional(readOnly = true)
    public ApiResponse<List<ReservationDTO>> getTransportReservations(@PathVariable Integer id) {
        List<TransportReservation> reservations = reservationRepository.findByTransport_TransportId(id);
        return ApiResponse.success(reservations.stream().map(this::toReservationDTO).toList());
    }

    @GetMapping("/transports/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<TransportDTO> getTransport(@PathVariable Integer id) {
        Transport t = transportRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_not_found"));
        return ApiResponse.success(toTransportDTO(t, countBookedSeatsFor(id)));
    }

    // ==================== TRANSPORT MUTATIONS ====================

    @PostMapping("/transports")
    @Transactional
    public ApiResponse<TransportDTO> createTransport(@RequestBody TransportRequest request) {
        Transport transport = buildAndValidateTransport(request, null);
        transport.setCreatedAt(LocalDateTime.now());
        transport = transportRepository.save(transport);
        return ApiResponse.success(toTransportDTO(transport, 0));
    }

    @PutMapping("/transports/{id}")
    @Transactional
    public ApiResponse<TransportDTO> updateTransport(@PathVariable Integer id, @RequestBody TransportRequest request) {
        Transport existing = transportRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_not_found"));
        Transport transport = buildAndValidateTransport(request, existing);
        transport.setTransportId(id);
        transport = transportRepository.save(transport);
        long booked = countBookedSeatsFor(id);
        return ApiResponse.success(toTransportDTO(transport, booked));
    }

    @PatchMapping("/transports/{id}/status")
    @Transactional
    public ApiResponse<TransportDTO> toggleTransportStatus(@PathVariable Integer id, @RequestBody StatusRequest request) {
        Transport transport = transportRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_not_found"));

        boolean willDeactivate = Boolean.FALSE.equals(request.isActive());
        if (willDeactivate) {
            long activeResCount = reservationRepository.countFutureActiveReservations(id);
            if (activeResCount > 0) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "api.error.transport.admin_has_active_bookings");
            }
        }

        transport.setIsActive(request.isActive());
        transport = transportRepository.save(transport);
        long booked = countBookedSeatsFor(id);
        return ApiResponse.success(toTransportDTO(transport, booked));
    }

    @DeleteMapping("/transports/{id}")
    @Transactional
    public ResponseEntity<?> deleteTransport(@PathVariable Integer id) {
        Transport transport = transportRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_not_found"));

        long futureActive = reservationRepository.countFutureActiveReservations(id);
        if (futureActive > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "api.error.transport.admin_cannot_delete_has_bookings");
        }

        long linkedReservations = reservationRepository.countByTransport_TransportId(id);
        if (linkedReservations > 0) {
            transport.setIsActive(false);
            transportRepository.save(transport);
            return ResponseEntity.ok(ApiResponse.success(null,
                "This route still has booking history in the database. It was deactivated and hidden from new searches instead of being permanently removed."));
        }

        transportRepository.delete(transport);
        return ResponseEntity.noContent().build();
    }

    // ==================== RESERVATION MANAGEMENT ====================

    @PatchMapping("/transport-reservations/{id}/confirm")
    @Transactional
    public ApiResponse<ReservationDTO> confirmReservation(@PathVariable Integer id) {
        TransportReservation reservation = reservationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "reservation.error.reservation_not_found"));
        reservation.setStatus(TransportReservation.ReservationStatus.CONFIRMED);
        reservation = reservationRepository.save(reservation);
        transportReservationService.sendTransportConfirmationWhatsApp(reservation);
        return ApiResponse.success(toReservationDTO(reservation));
    }

    @PatchMapping("/transport-reservations/{id}/cancel")
    @Transactional
    public ApiResponse<ReservationDTO> cancelReservation(@PathVariable Integer id, @RequestBody CancelRequest request) {
        TransportReservation reservation = reservationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "reservation.error.reservation_not_found"));
        reservation.setStatus(TransportReservation.ReservationStatus.CANCELLED);
        reservation = reservationRepository.save(reservation);
        return ApiResponse.success(toReservationDTO(reservation));
    }

    // ==================== VALIDATION HELPERS ====================

    private long countBookedSeatsFor(Integer transportId) {
        if (transportId == null) {
            return 0L;
        }
        return reservationRepository.countBookedSeats(transportId);
    }

    private Transport buildAndValidateTransport(TransportRequest req, Transport existing) {
        if (req.departureCityId() != null && req.departureCityId().equals(req.arrivalCityId())) {
            throw new InvalidTransportException("SAME_CITY", "La ville de départ et d'arrivée doivent être différentes");
        }

        City departureCity = cityRepository.findById(req.departureCityId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_departure_city_not_found"));
        City arrivalCity = cityRepository.findById(req.arrivalCityId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.transport.admin_arrival_city_not_found"));

        Transport.TransportType ttype = Transport.TransportType.valueOf(req.type());

        switch (ttype) {
            case PLANE:
                if (Boolean.FALSE.equals(departureCity.getHasAirport()))
                    throw new InvalidTransportException("NO_AIRPORT",
                        "Vol impossible : " + departureCity.getName() + " n'a pas d'aéroport");
                if (Boolean.FALSE.equals(arrivalCity.getHasAirport()))
                    throw new InvalidTransportException("NO_AIRPORT",
                        "Vol impossible : " + arrivalCity.getName() + " n'a pas d'aéroport");
                break;
            case BUS:
                if (Boolean.FALSE.equals(departureCity.getHasBusStation()))
                    throw new InvalidTransportException("NO_BUS_STATION",
                        departureCity.getName() + " n'a pas de gare routière");
                if (Boolean.FALSE.equals(arrivalCity.getHasBusStation()))
                    throw new InvalidTransportException("NO_BUS_STATION",
                        arrivalCity.getName() + " n'a pas de gare routière");
                break;
            default:
                break;
        }

        if (ttype == Transport.TransportType.PLANE) {
            if (req.operatorName() == null || req.operatorName().isBlank()) {
                throw new InvalidTransportException("PLANE_NEEDS_OPERATOR",
                    "La compagnie aérienne est obligatoire pour un avion");
            }
        } else {
            if (req.capacity() == null || req.capacity() < 1) {
                throw new InvalidTransportException("CAPACITY_REQUIRED",
                    "La capacité (nombre de places) est obligatoire pour ce type de transport");
            }
        }

        if (req.arrivalTime() != null && req.departureTime() != null) {
            if (!req.arrivalTime().isAfter(req.departureTime())) {
                throw new InvalidTransportException("INVALID_TIME",
                    "L'heure d'arrivée doit être après le départ");
            }
            long hours = Duration.between(req.departureTime(), req.arrivalTime()).toHours();
            Map<String, Long> maxHours = Map.of("TAXI", 8L, "CAR", 12L, "VAN", 8L, "BUS", 12L, "PLANE", 3L, "TRAIN", 12L, "FERRY", 24L);
            Long max = maxHours.getOrDefault(req.type(), 24L);
            if (hours > max) {
                throw new InvalidTransportException("DURATION_TOO_LONG",
                    "Durée anormalement longue pour ce type de transport (" + hours + "h)");
            }
        }

        if (req.price() != null) {
            Map<String, Double> maxPrice = Map.of("TAXI", 300.0, "CAR", 500.0, "VAN", 400.0, "BUS", 80.0, "PLANE", 400.0, "TRAIN", 100.0, "FERRY", 200.0);
            Double max = maxPrice.getOrDefault(req.type(), 1000.0);
            if (req.price() > max) {
                log.warn("Prix anormalement élevé pour {} : {} TND", req.type(), req.price());
            }
        }

        int capacity;
        if (ttype == Transport.TransportType.PLANE) {
            capacity = req.capacity() != null ? req.capacity() : 150;
        } else {
            capacity = req.capacity();
        }

        Transport transport = existing != null ? existing : new Transport();
        transport.setType(ttype);
        transport.setDepartureCity(departureCity);
        transport.setArrivalCity(arrivalCity);
        transport.setDepartureTime(req.departureTime());
        transport.setArrivalTime(req.arrivalTime());
        transport.setCapacity(capacity);
        transport.setPrice(req.price());
        transport.setDescription(req.description());
        transport.setOperatorName(req.operatorName());
        transport.setFlightCode(req.flightCode());
        transport.setIsActive(req.isActive() != null ? req.isActive() : true);
        return transport;
    }

    private TransportTypeAvailabilityDTO checkType(String type, String label, City dep, City arr) {
        return switch (type) {
            case "PLANE" -> {
                boolean ok = Boolean.TRUE.equals(dep.getHasAirport()) && Boolean.TRUE.equals(arr.getHasAirport());
                String reason = !ok ? (!Boolean.TRUE.equals(dep.getHasAirport()) ? dep.getName() : arr.getName()) + " n'a pas d'aéroport" : null;
                yield new TransportTypeAvailabilityDTO(type, label, ok, reason);
            }
            case "BUS" -> {
                boolean ok = Boolean.TRUE.equals(dep.getHasBusStation()) && Boolean.TRUE.equals(arr.getHasBusStation());
                String reason = !ok ? (!Boolean.TRUE.equals(dep.getHasBusStation()) ? dep.getName() : arr.getName()) + " n'a pas de gare routière" : null;
                yield new TransportTypeAvailabilityDTO(type, label, ok, reason);
            }
            default -> new TransportTypeAvailabilityDTO(type, label, true, null);
        };
    }

    private TransportDTO toTransportDTO(Transport t, long bookedSeats) {
        int avail = Math.max(0, (t.getCapacity() != null ? t.getCapacity() : 0) - (int) bookedSeats);
        return new TransportDTO(
            t.getTransportId(),
            t.getType() != null ? t.getType().name() : null,
            t.getDepartureTime(),
            t.getArrivalTime(),
            t.getCapacity(),
            t.getPrice(),
            t.getDescription(),
            t.getIsActive(),
            t.getDepartureCity() != null ? t.getDepartureCity().getCityId() : null,
            t.getDepartureCity() != null ? t.getDepartureCity().getName() : null,
            t.getArrivalCity() != null ? t.getArrivalCity().getCityId() : null,
            t.getArrivalCity() != null ? t.getArrivalCity().getName() : null,
            t.getOperatorName(),
            t.getFlightCode(),
            avail,
            (int) bookedSeats
        );
    }

    private ReservationDTO toReservationDTO(TransportReservation r) {
        return new ReservationDTO(
            r.getTransportReservationId(),
            r.getReservationRef(),
            r.getStatus() != null ? r.getStatus().name() : null,
            r.getPaymentStatus() != null ? r.getPaymentStatus().name() : null,
            r.getPaymentMethod() != null ? r.getPaymentMethod().name() : null,
            r.getTotalPrice(),
            r.getNumberOfSeats(),
            r.getTravelDate(),
            r.getPassengerFirstName(),
            r.getPassengerLastName(),
            r.getPassengerEmail(),
            r.getPassengerPhone(),
            r.getCreatedAt()
        );
    }

    // ==================== DTO RECORDS ====================

    public record TransportStatsDTO(
        long totalTransports,
        long activeTransports,
        long totalAvailableSeats,
        long todayReservations
    ) {}

    public record TransportTypeAvailabilityDTO(
        String type,
        String label,
        boolean isAvailable,
        String reason
    ) {}

    public record TransportDTO(
        Integer transportId,
        String type,
        LocalDateTime departureTime,
        LocalDateTime arrivalTime,
        Integer capacity,
        Double price,
        String description,
        Boolean isActive,
        Integer departureCityId,
        String departureCityName,
        Integer arrivalCityId,
        String arrivalCityName,
        String operatorName,
        String flightCode,
        int availableSeats,
        int bookedSeats
    ) {}

    public record ReservationDTO(
        Integer transportReservationId,
        String reservationRef,
        String status,
        String paymentStatus,
        String paymentMethod,
        Double totalPrice,
        Integer numberOfSeats,
        LocalDateTime travelDate,
        String passengerFirstName,
        String passengerLastName,
        String passengerEmail,
        String passengerPhone,
        LocalDateTime createdAt
    ) {}

    public record TransportRequest(
        String type,
        Integer departureCityId,
        Integer arrivalCityId,
        LocalDateTime departureTime,
        LocalDateTime arrivalTime,
        Integer capacity,
        Double price,
        String description,
        String operatorName,
        String flightCode,
        Boolean isActive
    ) {}

    public record StatusRequest(Boolean isActive) {}
    public record CancelRequest(String reason) {}
}
