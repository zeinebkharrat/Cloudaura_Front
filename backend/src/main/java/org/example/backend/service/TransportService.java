package org.example.backend.service;

import org.example.backend.dto.transport.TransportSearchRequest;
import org.example.backend.dto.transport.TransportSearchResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.Driver;
import org.example.backend.model.Transport;
import org.example.backend.model.Vehicle;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.DriverRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.VehicleRepository;
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
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;

    @Transactional
    public List<TransportSearchResponse> searchTransports(TransportSearchRequest request) {
        if (request.getTravelDate() == null) {
            request.setTravelDate(LocalDate.now());
        }

        City from = cityRepository.findById(request.getDepartureCityId())
                .orElseThrow(() -> new ResourceNotFoundException("City not found: " + request.getDepartureCityId()));
        City to = cityRepository.findById(request.getArrivalCityId())
                .orElseThrow(() -> new ResourceNotFoundException("City not found: " + request.getArrivalCityId()));

        List<Transport> transports = transportRepository.findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
                request.getDepartureCityId(),
                request.getArrivalCityId(),
                request.getTravelDate().atStartOfDay(),
                request.getTravelDate().atTime(23, 59, 59));

        if (transports.isEmpty()) {
            transports = generateDailyTransports(from, to, request.getTravelDate());
            if (!transports.isEmpty()) {
                transports = transportRepository.saveAll(transports);
            }
        }

        return transports.stream()
                .filter(t -> request.getType() == null || request.getType().equalsIgnoreCase("ALL") || request.getType().isEmpty() || t.getType().name().equalsIgnoreCase(request.getType()))
                .map(this::mapToResponse)
                .filter(t -> t.getAvailableSeats() >= request.getNumberOfPassengers())
                .collect(Collectors.toList());
    }

    private List<Transport> generateDailyTransports(City from, City to, LocalDate date) {
        List<Transport> generated = new ArrayList<>();
        
        List<Driver> drivers = driverRepository.findAll();
        List<Vehicle> vehicles = vehicleRepository.findAll();
        
        if (drivers.isEmpty() || vehicles.isEmpty()) return generated;

        Driver genericDriver = drivers.get(0);
        Vehicle genericTaxi = vehicles.stream().filter(v -> v.getType() == Vehicle.VehicleType.VAN || v.getType() == Vehicle.VehicleType.TAXI).findFirst().orElse(vehicles.get(0));
        Vehicle genericBus = vehicles.stream().filter(v -> v.getType() == Vehicle.VehicleType.BUS).findFirst().orElse(vehicles.get(0));
        Vehicle genericPlane = vehicles.stream().filter(v -> v.getType() == Vehicle.VehicleType.PLANE).findFirst().orElse(genericBus);
        
        double baseFactor = Math.abs(from.getCityId() - to.getCityId()) * 1.5;
        double distFactor = Math.max(1.0, baseFactor);
        int durationMinutes = (int)(distFactor * 45);

        Transport taxi = createMockTransport(from, to, date.atTime(10, 0), Transport.TransportType.TAXI, genericTaxi, genericDriver, 25.0 * distFactor, 4, durationMinutes);
        generated.add(taxi);

        Transport bus1 = createMockTransport(from, to, date.atTime(8, 0), Transport.TransportType.BUS, genericBus, genericDriver, 15.0 * distFactor, 45, durationMinutes);
        Transport bus2 = createMockTransport(from, to, date.atTime(15, 0), Transport.TransportType.BUS, genericBus, genericDriver, 15.0 * distFactor, 45, durationMinutes);
        generated.add(bus1);
        generated.add(bus2);

        if (from.getHasAirport() != null && from.getHasAirport() && to.getHasAirport() != null && to.getHasAirport()) {
             Transport plane = createMockTransport(from, to, date.atTime(11, 30), Transport.TransportType.PLANE, genericPlane, genericDriver, 120.0 * distFactor, 150, Math.max(45, durationMinutes / 3));
             generated.add(plane);
        }

        return generated;
    }

    private Transport createMockTransport(City from, City to, LocalDateTime departure, Transport.TransportType type, Vehicle v, Driver d, double price, int capacity, int durationMinutes) {
        return Transport.builder()
                .departureCity(from)
                .arrivalCity(to)
                .departureTime(departure)
                .arrivalTime(departure.plusMinutes(durationMinutes))
                .type(type)
                .vehicle(v)
                .driver(d)
                .price((double) Math.round(price * 100) / 100)
                .capacity(capacity)
                .isActive(true)
                .build();
    }

    @Transactional(readOnly = true)
    public TransportSearchResponse getTransportById(int id) {
        Transport transport = transportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transport non trouvé avec l'id: " + id));
        if (!transport.getIsActive()) throw new ResourceNotFoundException("Ce transport n'est plus actif.");
        return mapToResponse(transport);
    }

    private TransportSearchResponse mapToResponse(Transport t) {
        int booked = reservationRepository.countBookedSeats(t.getTransportId());
        int available = t.getCapacity() - booked;

        return TransportSearchResponse.builder()
                .transportId(t.getTransportId())
                .type(t.getType().name())
                .departureCityName(t.getDepartureCity().getName())
                .arrivalCityName(t.getArrivalCity().getName())
                .departureTime(t.getDepartureTime())
                .arrivalTime(t.getArrivalTime())
                .price(t.getPrice())
                .capacity(t.getCapacity())
                .availableSeats(available)
                .durationMinutes((int) Duration.between(t.getDepartureTime(), t.getArrivalTime()).toMinutes())
                .vehicleBrand(t.getVehicle().getBrand())
                .vehicleModel(t.getVehicle().getModel())
                .driverName(t.getDriver().getFirstName() + " " + t.getDriver().getLastName())
                .driverRating(t.getDriver().getRating())
                .isActive(t.getIsActive())
                .build();
    }
}
