package org.example.backend.service;

import org.example.backend.dto.transport.TransportSearchRequest;
import org.example.backend.dto.transport.TransportSearchResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Transport;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransportService {
    private final TransportRepository transportRepository;
    private final TransportReservationRepository reservationRepository;

    @Transactional(readOnly = true)
    public List<TransportSearchResponse> searchTransports(TransportSearchRequest request) {
        List<Transport> transports;
        if (request.getTravelDate() != null) {
            transports = transportRepository.findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
                    request.getDepartureCityId(),
                    request.getArrivalCityId(),
                    request.getTravelDate().atStartOfDay(),
                    request.getTravelDate().atTime(23, 59, 59));
        } else {
            transports = transportRepository.findByDepartureCity_CityIdAndArrivalCity_CityIdAndIsActiveTrue(
                    request.getDepartureCityId(),
                    request.getArrivalCityId());
        }

        return transports.stream()
                .map(this::mapToResponse)
                .filter(t -> t.getAvailableSeats() >= request.getNumberOfPassengers())
                .collect(Collectors.toList());
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
