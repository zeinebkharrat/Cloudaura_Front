package com.yallatn.service.accommodation;

import com.yallatn.dto.accommodation.AccommodationReservationRequest;
import com.yallatn.dto.accommodation.AccommodationReservationResponse;
import com.yallatn.exception.CancellationNotAllowedException;
import com.yallatn.exception.RoomNotAvailableException;
import com.yallatn.exception.ResourceNotFoundException;
import com.yallatn.model.accommodation.Reservation;
import com.yallatn.model.accommodation.Room;
import com.yallatn.model.shared.SpecialOffer;
import com.yallatn.model.shared.User;
import com.yallatn.repository.accommodation.ReservationRepository;
import com.yallatn.repository.accommodation.RoomRepository;
import com.yallatn.repository.shared.SpecialOfferRepository;
import com.yallatn.repository.shared.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccommodationReservationService {
    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final SpecialOfferRepository specialOfferRepository;

    @Transactional
    public AccommodationReservationResponse createReservation(AccommodationReservationRequest req) {
        if (req.getCheckIn().isAfter(req.getCheckOut())) {
            throw new IllegalArgumentException("La date d'arrivée doit être avant la date de départ.");
        }

        Room room = roomRepository.findById(req.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Chambre introuvable."));

        // Double check availability
        List<Room> available = roomRepository.findAvailableRooms(
                room.getAccommodation().getAccommodationId(),
                req.getCheckIn().atStartOfDay(),
                req.getCheckOut().atStartOfDay());
        if (!available.contains(room)) {
            throw new RoomNotAvailableException("La chambre n'est plus disponible pour ces dates.");
        }

        User user = userRepository.findById(req.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable."));

        long nights = ChronoUnit.DAYS.between(req.getCheckIn(), req.getCheckOut());
        double totalPrice = room.getPrice() * nights;
        double discount = 0;

        if (req.getOfferId() != null) {
            SpecialOffer offer = specialOfferRepository.findById(req.getOfferId())
                    .orElseThrow(() -> new ResourceNotFoundException("Offre introuvable."));
            discount = totalPrice * (offer.getDiscountPercentage() / 100.0);
            totalPrice -= discount;
        }

        Reservation res = Reservation.builder()
                .checkInDate(req.getCheckIn().atStartOfDay())
                .checkOutDate(req.getCheckOut().atStartOfDay())
                .status(Reservation.ReservationStatus.PENDING)
                .totalPrice(totalPrice)
                .room(room)
                .user(user)
                .build();

        Reservation saved = reservationRepository.save(res);
        return mapToResponse(saved, (int) nights, discount);
    }

    @Transactional
    public AccommodationReservationResponse cancelReservation(int id, int userId) {
        Reservation res = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation introuvable."));
        if (!res.getUser().getUserId().equals(userId)) throw new RuntimeException("Accès refusé.");
        if (res.getCheckInDate().isBefore(LocalDateTime.now().plusHours(24))) {
            throw new CancellationNotAllowedException("Annulation impossible moins de 24h avant l'arrivée.");
        }

        res.setStatus(Reservation.ReservationStatus.CANCELLED);
        return mapToResponse(reservationRepository.save(res), 0, 0);
    }

    @Transactional(readOnly = true)
    public List<AccommodationReservationResponse> getUserReservations(int userId) {
        return reservationRepository.findByUser_UserId(userId).stream()
                .sorted((a, b) -> b.getCheckInDate().compareTo(a.getCheckInDate()))
                .map(r -> mapToResponse(r, (int) ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate()), 0))
                .collect(Collectors.toList());
    }

    private AccommodationReservationResponse mapToResponse(Reservation r, int nights, double discount) {
        return AccommodationReservationResponse.builder()
                .reservationId(r.getReservationId())
                .status(r.getStatus().name())
                .checkIn(r.getCheckInDate().toLocalDate())
                .checkOut(r.getCheckOutDate().toLocalDate())
                .nights(nights)
                .totalPrice(r.getTotalPrice())
                .discountApplied(discount)
                .accommodationName(r.getRoom().getAccommodation().getName())
                .roomType(r.getRoom().getRoomType().name())
                .cityName(r.getRoom().getAccommodation().getCity().getName())
                .build();
    }
}
