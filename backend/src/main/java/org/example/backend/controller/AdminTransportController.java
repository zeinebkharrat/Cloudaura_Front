package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.exception.InvalidTransportException;
import org.example.backend.exception.VehicleConflictException;
import org.example.backend.exception.DriverConflictException;
import org.example.backend.model.*;
import org.example.backend.repository.*;
import org.example.backend.service.TransportReservationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminTransportController {

    private final TransportRepository transportRepository;
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final CityRepository cityRepository;
    private final TransportReservationRepository reservationRepository;
    private final TransportReservationService transportReservationService;

    // ==================== STATS ====================

    @GetMapping("/transports/stats")
    @Transactional(readOnly = true)
    public ApiResponse<TransportStatsDTO> getStats() {
        long total   = transportRepository.count();
        long active  = transportRepository.countActive();
        long vehicles = vehicleRepository.countByIsActiveTrue();
        long drivers  = driverRepository.countByIsActiveTrue();

        // Calculate available seats dynamically
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
            total, active, availableSeats, vehicles, drivers, todayReservations
        ));
    }

    // ==================== TRANSPORT QUERIES (literal paths before /transports/{id}) ====================

    @GetMapping("/transports/available-types")
    @Transactional(readOnly = true)
    public ApiResponse<List<TransportTypeAvailabilityDTO>> getAvailableTypes(
            @RequestParam Integer departureCityId,
            @RequestParam Integer arrivalCityId) {

        City dep = cityRepository.findById(departureCityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Departure city not found"));
        City arr = cityRepository.findById(arrivalCityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Arrival city not found"));

        List<TransportTypeAvailabilityDTO> result = new ArrayList<>();

        result.add(checkType("PLANE", "Avion", dep, arr));
        result.add(checkType("BUS", "Bus", dep, arr));
        result.add(checkType("VAN", "Van / Louage", dep, arr));
        result.add(checkType("TAXI", "Taxi", dep, arr));
        result.add(checkType("CAR", "Voiture", dep, arr));

        return ApiResponse.success(result);
    }

    @GetMapping("/transports/available-vehicles")
    @Transactional(readOnly = true)
    public ApiResponse<List<VehicleDTO>> getAvailableVehicles(
            @RequestParam String type,
            @RequestParam(required = false) String departure,
            @RequestParam(required = false) String arrival) {

        List<Vehicle.VehicleType> compatibleTypes = getCompatibleVehicleTypes(type);
        if (compatibleTypes.isEmpty()) {
            return ApiResponse.success(Collections.emptyList());
        }

        List<Vehicle> vehicles = vehicleRepository.findByTypeInAndIsActiveTrue(compatibleTypes);

        if (departure != null && arrival != null) {
            LocalDateTime dep = parseAdminDateTimeParam(departure, "departure");
            LocalDateTime arr = parseAdminDateTimeParam(arrival, "arrival");
            vehicles = vehicles.stream()
                .filter(v -> !transportRepository.existsByVehicleIdAndTimeOverlap(v.getVehicleId(), dep, arr))
                .collect(Collectors.toList());
        }

        return ApiResponse.success(vehicles.stream().map(this::toVehicleDTO).collect(Collectors.toList()));
    }

    @GetMapping("/transports/available-drivers")
    @Transactional(readOnly = true)
    public ApiResponse<List<DriverDTO>> getAvailableDrivers(
            @RequestParam(required = false) String departure,
            @RequestParam(required = false) String arrival) {

        List<Driver> drivers = driverRepository.findByIsActiveTrue();

        if (departure != null && arrival != null) {
            LocalDateTime dep = parseAdminDateTimeParam(departure, "departure");
            LocalDateTime arr = parseAdminDateTimeParam(arrival, "arrival");
            drivers = drivers.stream()
                .filter(d -> !transportRepository.existsByDriverIdAndTimeOverlap(d.getDriverId(), dep, arr))
                .collect(Collectors.toList());
        }

        return ApiResponse.success(drivers.stream().map(this::toDriverDTO).collect(Collectors.toList()));
    }

    @GetMapping("/transports")
    @Transactional(readOnly = true)
    public ApiResponse<List<TransportDTO>> getAllTransports() {
        List<Transport> transports = transportRepository.findAll();
        List<TransportDTO> dtos = transports.stream()
            .map(t -> toTransportDTO(t, countBookedSeatsFor(t.getTransportId())))
            .collect(Collectors.toList());
        return ApiResponse.success(dtos);
    }

    @GetMapping("/transports/{id}/reservations")
    @Transactional(readOnly = true)
    public ApiResponse<List<ReservationDTO>> getTransportReservations(@PathVariable Integer id) {
        List<TransportReservation> reservations = reservationRepository.findByTransport_TransportId(id);
        return ApiResponse.success(reservations.stream().map(this::toReservationDTO).collect(Collectors.toList()));
    }

    @GetMapping("/transports/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<TransportDTO> getTransport(@PathVariable Integer id) {
        Transport t = transportRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transport not found"));
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
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transport not found"));
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
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transport not found"));

        boolean willDeactivate = Boolean.FALSE.equals(request.isActive());
        if (willDeactivate) {
            long activeResCount = reservationRepository.countFutureActiveReservations(id);
            if (activeResCount > 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot deactivate: " + activeResCount + " active reservation(s) on this transport");
            }
        }

        transport.setIsActive(request.isActive());
        transport = transportRepository.save(transport);
        long booked = countBookedSeatsFor(id);
        return ApiResponse.success(toTransportDTO(transport, booked));
    }

    @DeleteMapping("/transports/{id}")
    @Transactional
    public ApiResponse<Void> deleteTransport(@PathVariable Integer id) {
        Transport transport = transportRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transport not found"));

        long futureActive = reservationRepository.countFutureActiveReservations(id);
        if (futureActive > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Cannot remove this transport: it has upcoming pending or confirmed bookings. Cancel or reassign them first.");
        }

        long linkedReservations = reservationRepository.countByTransport_TransportId(id);
        if (linkedReservations > 0) {
            // FK prevents hard delete while any reservation row references this transport
            transport.setIsActive(false);
            transportRepository.save(transport);
            return ApiResponse.success(null,
                "This route still has booking history in the database. It was deactivated and hidden from new searches instead of being permanently removed.");
        }

        transportRepository.delete(transport);
        return ApiResponse.<Void>success(null);
    }

    // ==================== VEHICLE CRUD ====================

    @GetMapping("/vehicles")
    @Transactional(readOnly = true)
    public ApiResponse<List<VehicleDTO>> getAllVehicles() {
        return ApiResponse.success(vehicleRepository.findAll().stream().map(this::toVehicleDTO).collect(Collectors.toList()));
    }

    @GetMapping("/vehicles/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<VehicleDTO> getVehicle(@PathVariable Integer id) {
        Vehicle vehicle = vehicleRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        return ApiResponse.success(toVehicleDTO(vehicle));
    }

    @PostMapping("/vehicles")
    @Transactional
    public ApiResponse<VehicleDTO> createVehicle(@RequestBody VehicleRequest request) {
        validateVehicleRequest(request);
        Vehicle vehicle = Vehicle.builder()
            .brand(request.brand())
            .model(request.model())
            .type(Vehicle.VehicleType.valueOf(request.type()))
            .capacity(request.capacity())
            .plateNumber(request.plateNumber())
            .pricePerTrip(request.pricePerTrip())
            .color(request.color() != null && !request.color().isBlank() ? request.color() : "Non renseigné")
            .year(request.year() != null ? request.year() : 2020)
            .isActive(request.isActive() != null ? request.isActive() : true)
            .createdAt(LocalDateTime.now())
            .build();
        vehicle = vehicleRepository.save(vehicle);
        return ApiResponse.success(toVehicleDTO(vehicle));
    }

    @PutMapping("/vehicles/{id}")
    @Transactional
    public ApiResponse<VehicleDTO> updateVehicle(@PathVariable Integer id, @RequestBody VehicleRequest request) {
        Vehicle vehicle = vehicleRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
        validateVehicleRequest(request);
        vehicle.setBrand(request.brand());
        vehicle.setModel(request.model());
        vehicle.setType(Vehicle.VehicleType.valueOf(request.type()));
        vehicle.setCapacity(request.capacity());
        vehicle.setPlateNumber(request.plateNumber());
        vehicle.setPricePerTrip(request.pricePerTrip());
        vehicle.setColor(request.color() != null && !request.color().isBlank() ? request.color() : "Non renseigné");
        vehicle.setYear(request.year() != null ? request.year() : 2020);
        if (request.isActive() != null) vehicle.setIsActive(request.isActive());
        vehicle = vehicleRepository.save(vehicle);
        return ApiResponse.success(toVehicleDTO(vehicle));
    }

    @DeleteMapping("/vehicles/{id}")
    @Transactional
    public ApiResponse<Void> deleteVehicle(@PathVariable Integer id) {
        boolean inUse = transportRepository.findAll().stream()
            .anyMatch(t -> t.getVehicle() != null && t.getVehicle().getVehicleId().equals(id) && Boolean.TRUE.equals(t.getIsActive()));
        if (inUse) {
            throw new VehicleConflictException("This vehicle is assigned to an active transport");
        }
        vehicleRepository.deleteById(id);
        return ApiResponse.<Void>success(null);
    }

    // ==================== DRIVER CRUD ====================

    @GetMapping("/drivers")
    @Transactional(readOnly = true)
    public ApiResponse<List<DriverDTO>> getAllDrivers() {
        return ApiResponse.success(driverRepository.findAll().stream()
            .map(d -> toDriverDTOWithTrips(d))
            .collect(Collectors.toList()));
    }

    @GetMapping("/drivers/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<DriverDTO> getDriver(@PathVariable Integer id) {
        Driver driver = driverRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        return ApiResponse.success(toDriverDTOWithTrips(driver));
    }

    @PostMapping("/drivers")
    @Transactional
    public ApiResponse<DriverDTO> createDriver(@RequestBody DriverRequest request) {
        if (request.email() == null || request.email().isBlank()) {
            throw new InvalidTransportException("EMAIL_REQUIRED", "Driver email is required");
        }
        Driver driver = Driver.builder()
            .firstName(request.firstName())
            .lastName(request.lastName())
            .licenseNumber(request.licenseNumber())
            .phone(request.phone())
            .email(request.email())
            .rating(0.0)
            .totalTrips(0)
            .isActive(request.isActive() != null ? request.isActive() : true)
            .build();
        driver = driverRepository.save(driver);
        return ApiResponse.success(toDriverDTOWithTrips(driver));
    }

    @PutMapping("/drivers/{id}")
    @Transactional
    public ApiResponse<DriverDTO> updateDriver(@PathVariable Integer id, @RequestBody DriverRequest request) {
        Driver driver = driverRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        if (request.email() == null || request.email().isBlank()) {
            throw new InvalidTransportException("EMAIL_REQUIRED", "Driver email is required");
        }
        driver.setFirstName(request.firstName());
        driver.setLastName(request.lastName());
        driver.setLicenseNumber(request.licenseNumber());
        driver.setPhone(request.phone());
        driver.setEmail(request.email());
        if (request.isActive() != null) driver.setIsActive(request.isActive());
        driver = driverRepository.save(driver);
        return ApiResponse.success(toDriverDTOWithTrips(driver));
    }

    @DeleteMapping("/drivers/{id}")
    @Transactional
    public ApiResponse<Void> deleteDriver(@PathVariable Integer id) {
        boolean inUse = transportRepository.findAll().stream()
            .anyMatch(t -> t.getDriver() != null && t.getDriver().getDriverId().equals(id) && Boolean.TRUE.equals(t.getIsActive()));
        if (inUse) {
            throw new DriverConflictException("This driver is assigned to an active transport");
        }
        driverRepository.deleteById(id);
        return ApiResponse.<Void>success(null);
    }

    // ==================== RESERVATION MANAGEMENT ====================

    @PatchMapping("/transport-reservations/{id}/confirm")
    @Transactional
    public ApiResponse<ReservationDTO> confirmReservation(@PathVariable Integer id) {
        TransportReservation reservation = reservationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
        reservation.setStatus(TransportReservation.ReservationStatus.CONFIRMED);
        reservation = reservationRepository.save(reservation);
        transportReservationService.sendTransportConfirmationWhatsApp(reservation);
        return ApiResponse.success(toReservationDTO(reservation));
    }

    @PatchMapping("/transport-reservations/{id}/cancel")
    @Transactional
    public ApiResponse<ReservationDTO> cancelReservation(@PathVariable Integer id, @RequestBody CancelRequest request) {
        TransportReservation reservation = reservationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
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

    /**
     * Accepts naive local {@code yyyy-MM-dd'T'HH:mm[:ss]} (same as {@link LocalDateTime} JSON) or ISO-8601 with
     * offset/Z so availability filtering matches POST body overlap checks (avoids UTC drift from {@code toISOString()}).
     */
    private static LocalDateTime parseAdminDateTimeParam(String raw, String label) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing " + label);
        }
        String s = raw.trim();
        try {
            return LocalDateTime.parse(s);
        } catch (DateTimeParseException ignored) {
            /* fall through */
        }
        try {
            return Instant.parse(s).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } catch (DateTimeException ignored) {
            /* fall through */
        }
        try {
            return LocalDateTime.parse(s, DateTimeFormatter.ISO_DATE_TIME);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid " + label + " datetime: " + raw);
        }
    }

    private Transport buildAndValidateTransport(TransportRequest req, Transport existing) {
        // 1. Same city check
        if (req.departureCityId() != null && req.departureCityId().equals(req.arrivalCityId())) {
            throw new InvalidTransportException("SAME_CITY", "La ville de départ et d'arrivée doivent être différentes");
        }

        City departureCity = cityRepository.findById(req.departureCityId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Departure city not found"));
        City arrivalCity = cityRepository.findById(req.arrivalCityId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Arrival city not found"));

        Transport.TransportType ttype = Transport.TransportType.valueOf(req.type());

        // 2. Geographic infrastructure (admin): only block when a city is explicitly marked without
        // the facility. Null = unknown / legacy data → allow create/update.
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
            default: break;
        }

        // 3. Driver/operator logic
        if (ttype == Transport.TransportType.PLANE && req.driverId() != null) {
            throw new InvalidTransportException("PLANE_NO_DRIVER",
                "A plane cannot have a driver. Provide the airline.");
        }
        if (ttype == Transport.TransportType.PLANE && (req.operatorName() == null || req.operatorName().isBlank())) {
            throw new InvalidTransportException("PLANE_NEEDS_OPERATOR",
                "La compagnie aérienne est obligatoire pour un avion");
        }
        if (ttype != Transport.TransportType.PLANE && req.driverId() == null) {
            throw new InvalidTransportException("DRIVER_REQUIRED",
                "A driver is required for this transport type");
        }

        // 4. Vehicle type compatibility
        Vehicle vehicle = null;
        if (ttype != Transport.TransportType.PLANE) {
            if (req.vehicleId() == null) {
                throw new InvalidTransportException("VEHICLE_REQUIRED", "A vehicle is required for this transport type");
            }
            vehicle = vehicleRepository.findById(req.vehicleId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vehicle not found"));
            List<Vehicle.VehicleType> allowed = getCompatibleVehicleTypes(req.type());
            if (!allowed.contains(vehicle.getType())) {
                throw new InvalidTransportException("VEHICLE_TYPE_MISMATCH",
                    "A " + vehicle.getType() + " vehicle cannot be used for " + ttype);
            }
        }

        // 5. Temporal validation
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

        // 6. Price warning (non-blocking)
        if (req.price() != null) {
            Map<String, Double> maxPrice = Map.of("TAXI", 300.0, "CAR", 500.0, "VAN", 400.0, "BUS", 80.0, "PLANE", 400.0, "TRAIN", 100.0, "FERRY", 200.0);
            Double max = maxPrice.getOrDefault(req.type(), 1000.0);
            if (req.price() > max) {
                log.warn("Prix anormalement élevé pour {} : {} TND", req.type(), req.price());
            }
        }

        // 7. Overlap checks (skip for update of same transport)
        Integer excludeId = existing != null ? existing.getTransportId() : null;
        if (vehicle != null && req.departureTime() != null && req.arrivalTime() != null) {
            boolean vehicleConflict = excludeId != null
                ? transportRepository.existsByVehicleIdAndTimeOverlapExcluding(req.vehicleId(), req.departureTime(), req.arrivalTime(), excludeId)
                : transportRepository.existsByVehicleIdAndTimeOverlap(req.vehicleId(), req.departureTime(), req.arrivalTime());
            if (vehicleConflict) {
                throw new VehicleConflictException("This vehicle is already assigned to a trip in this time slot");
            }
        }

        Driver driver = null;
        if (req.driverId() != null) {
            driver = driverRepository.findById(req.driverId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
            if (req.departureTime() != null && req.arrivalTime() != null) {
                boolean driverConflict = excludeId != null
                    ? transportRepository.existsByDriverIdAndTimeOverlapExcluding(req.driverId(), req.departureTime(), req.arrivalTime(), excludeId)
                    : transportRepository.existsByDriverIdAndTimeOverlap(req.driverId(), req.departureTime(), req.arrivalTime());
                if (driverConflict) {
                    throw new DriverConflictException("This driver is already assigned to a trip in this time slot");
                }
            }
        }

        // 8. Capacity: inherit from vehicle (unless PLANE)
        int capacity;
        if (ttype == Transport.TransportType.PLANE) {
            capacity = req.capacity() != null ? req.capacity() : 150;
        } else {
            capacity = vehicle != null && vehicle.getCapacity() != null ? vehicle.getCapacity() : (req.capacity() != null ? req.capacity() : 1);
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
        transport.setVehicle(vehicle);
        transport.setDriver(driver);
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

    private void validateVehicleRequest(VehicleRequest req) {
        if (req.color() == null || req.color().isBlank()) {
            throw new InvalidTransportException("COLOR_REQUIRED", "Vehicle color is required");
        }
        if (req.year() == null || req.year() < 2000 || req.year() > 2030) {
            throw new InvalidTransportException("YEAR_INVALID", "Vehicle year must be between 2000 and 2030");
        }
    }

    private List<Vehicle.VehicleType> getCompatibleVehicleTypes(String transportType) {
        return switch (transportType) {
            case "BUS"   -> List.of(Vehicle.VehicleType.BUS);
            case "VAN"   -> List.of(Vehicle.VehicleType.VAN);
            case "TAXI"  -> List.of(Vehicle.VehicleType.CAR, Vehicle.VehicleType.TAXI);
            case "CAR"   -> List.of(Vehicle.VehicleType.CAR);
            case "TRAIN" -> List.of(Vehicle.VehicleType.TRAIN);
            case "FERRY" -> List.of(Vehicle.VehicleType.FERRY);
            default      -> Collections.emptyList();
        };
    }

    // ==================== DTO MAPPINGS ====================

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
            t.getVehicle() != null ? t.getVehicle().getVehicleId() : null,
            t.getVehicle() != null ? t.getVehicle().getBrand() + " " + t.getVehicle().getModel() : null,
            t.getVehicle() != null ? t.getVehicle().getCapacity() : null,
            t.getDriver() != null ? t.getDriver().getDriverId() : null,
            t.getDriver() != null ? t.getDriver().getFirstName() + " " + t.getDriver().getLastName() : null,
            t.getOperatorName(),
            t.getFlightCode(),
            avail,
            (int) bookedSeats
        );
    }

    private VehicleDTO toVehicleDTO(Vehicle v) {
        return new VehicleDTO(
            v.getVehicleId(),
            v.getBrand(),
            v.getModel(),
            v.getType() != null ? v.getType().name() : null,
            v.getCapacity(),
            v.getPlateNumber(),
            v.getPricePerTrip(),
            v.getColor(),
            v.getYear(),
            v.getPhotoUrl(),
            v.getIsActive(),
            v.getBrand() + " " + v.getModel() + " (" + v.getCapacity() + " pl.) – " + v.getPlateNumber()
        );
    }

    private DriverDTO toDriverDTO(Driver d) {
        return toDriverDTOWithTrips(d);
    }

    private DriverDTO toDriverDTOWithTrips(Driver d) {
        long trips = transportRepository.findAll().stream()
            .filter(t -> t.getDriver() != null && t.getDriver().getDriverId().equals(d.getDriverId()))
            .count();
        return new DriverDTO(
            d.getDriverId(),
            d.getFirstName(),
            d.getLastName(),
            d.getFirstName() + " " + d.getLastName(),
            d.getLicenseNumber(),
            d.getPhone(),
            d.getEmail(),
            d.getPhotoUrl(),
            d.getRating(),
            (int) trips,
            d.getIsActive()
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
        long totalVehicles,
        long totalDrivers,
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
        Integer vehicleId,
        String vehicleInfo,
        Integer vehicleCapacity,
        Integer driverId,
        String driverName,
        String operatorName,
        String flightCode,
        int availableSeats,
        int bookedSeats
    ) {}

    public record VehicleDTO(
        Integer vehicleId,
        String brand,
        String model,
        String type,
        Integer capacity,
        String plateNumber,
        Double pricePerTrip,
        String color,
        Integer year,
        String photoUrl,
        Boolean isActive,
        String displayLabel
    ) {}

    public record DriverDTO(
        Integer driverId,
        String firstName,
        String lastName,
        String fullName,
        String licenseNumber,
        String phone,
        String email,
        String photoUrl,
        Double rating,
        Integer totalTrips,
        Boolean isActive
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
        Integer vehicleId,
        Integer driverId,
        Boolean isActive
    ) {}

    public record VehicleRequest(
        String brand,
        String model,
        String type,
        Integer capacity,
        String plateNumber,
        Double pricePerTrip,
        String color,
        Integer year,
        Boolean isActive
    ) {}

    public record DriverRequest(
        String firstName,
        String lastName,
        String licenseNumber,
        String phone,
        String email,
        Boolean isActive
    ) {}

    public record StatusRequest(Boolean isActive) {}
    public record CancelRequest(String reason) {}
}
