package com.yallatn.service.transport;

import com.yallatn.dto.transport.TransportReservationRequest;
import com.yallatn.dto.transport.TransportReservationResponse;
import com.yallatn.exception.NoSeatsAvailableException;
import com.yallatn.exception.ResourceNotFoundException;
import com.yallatn.model.shared.User;
import com.yallatn.model.transport.Transport;
import com.yallatn.model.transport.TransportReservation;
import com.yallatn.repository.shared.UserRepository;
import com.yallatn.repository.transport.TransportRepository;
import com.yallatn.repository.transport.TransportReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransportReservationService {
    private final TransportReservationRepository reservationRepository;
    private final TransportRepository transportRepository;
    private final UserRepository userRepository;

    @Transactional
    public TransportReservationResponse createReservation(TransportReservationRequest req) {
        // 1. Idempotency check
        if (reservationRepository.existsByIdempotencyKey(req.getIdempotencyKey())) {
            return reservationRepository.findByReservationRef(req.getIdempotencyKey())
                    .map(this::mapToResponse)
                    .orElseThrow(() -> new RuntimeException("Erreur idempotence : clé existante mais réf introuvable."));
        }

        // 2. Load and validate transport
        Transport transport = transportRepository.findById(req.getTransportId())
                .orElseThrow(() -> new ResourceNotFoundException("Transport non trouvé."));
        if (!transport.getIsActive()) throw new ResourceNotFoundException("Transport inactif.");

        // 4. Check available seats
        int booked = reservationRepository.countBookedSeats(transport.getTransportId());
        if (booked + req.getNumberOfSeats() > transport.getCapacity()) {
            throw new NoSeatsAvailableException("Plus de places disponibles pour ce voyage.");
        }

        // 5. Load user
        User user = userRepository.findById(req.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé."));

        // 6. Build reservation
        TransportReservation reservation = TransportReservation.builder()
                .status(TransportReservation.ReservationStatus.PENDING)
                .totalPrice(transport.getPrice() * req.getNumberOfSeats())
                .travelDate(transport.getDepartureTime())
                .numberOfSeats(req.getNumberOfSeats())
                .passengerFirstName(req.getPassengerFirstName())
                .passengerLastName(req.getPassengerLastName())
                .passengerEmail(req.getPassengerEmail())
                .passengerPhone(req.getPassengerPhone())
                .paymentMethod(TransportReservation.PaymentMethod.valueOf(req.getPaymentMethod()))
                .paymentStatus(TransportReservation.PaymentStatus.PENDING)
                .reservationRef("TR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .idempotencyKey(req.getIdempotencyKey())
                .createdAt(LocalDateTime.now())
                .transport(transport)
                .user(user)
                .build();

        // 8. Payment Simulation
        if (reservation.getPaymentMethod() == TransportReservation.PaymentMethod.KONNECT) {
            log.info("KONNECT payment initiated for ref: {}", reservation.getReservationRef());
            reservation.setPaymentStatus(TransportReservation.PaymentStatus.PAID);
            reservation.setStatus(TransportReservation.ReservationStatus.CONFIRMED);
        }

        return mapToResponse(reservationRepository.save(reservation));
    }

    @Transactional
    public TransportReservationResponse cancelReservation(int id, int userId) {
        TransportReservation res = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        if (!res.getUser().getUserId().equals(userId)) throw new RuntimeException("Non autorisé.");
        if (res.getStatus() == TransportReservation.ReservationStatus.CANCELLED) throw new RuntimeException("Déjà annulée.");

        res.setStatus(TransportReservation.ReservationStatus.CANCELLED);
        if (res.getPaymentStatus() == TransportReservation.PaymentStatus.PAID) {
            res.setPaymentStatus(TransportReservation.PaymentStatus.REFUNDED);
        }

        return mapToResponse(reservationRepository.save(res));
    }

    @Transactional(readOnly = true)
    public List<TransportReservationResponse> getUserReservations(int userId) {
        return reservationRepository.findByUser_UserId(userId).stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private TransportReservationResponse mapToResponse(TransportReservation r) {
        return TransportReservationResponse.builder()
                .transportReservationId(r.getTransportReservationId())
                .reservationRef(r.getReservationRef())
                .status(r.getStatus().name())
                .paymentStatus(r.getPaymentStatus().name())
                .paymentMethod(r.getPaymentMethod().name())
                .totalPrice(r.getTotalPrice())
                .numberOfSeats(r.getNumberOfSeats())
                .passengerFullName(r.getPassengerFirstName() + " " + r.getPassengerLastName())
                .travelDate(r.getTravelDate())
                .departureCityName(r.getTransport().getDepartureCity().getName())
                .arrivalCityName(r.getTransport().getArrivalCity().getName())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
