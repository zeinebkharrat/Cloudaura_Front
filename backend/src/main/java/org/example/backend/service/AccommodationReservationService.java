package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.example.backend.dto.accommodation.AccommodationReservationRequest;
import org.example.backend.dto.accommodation.AccommodationReservationResponse;
import org.example.backend.dto.accommodation.AccommodationReservationUpdateRequest;
import org.example.backend.dto.accommodation.AccommodationStripeCheckoutHandoff;
import org.example.backend.exception.CancellationNotAllowedException;
import org.example.backend.exception.RoomNotAvailableException;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Reservation;
import org.example.backend.model.ReservationStatus;
import org.example.backend.model.Room;
import org.example.backend.model.SpecialOffer;
import org.example.backend.model.User;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.RoomRepository;
import org.example.backend.repository.SpecialOfferRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.util.StripeSecretKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccommodationReservationService {
    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final SpecialOfferRepository specialOfferRepository;

    @Value("${stripe.api.key:disabled}")
    private String stripeApiKey;

    private record SavedStay(Reservation reservation, int nights, double discount) {}

    public boolean isStripeAccommodationPaymentsEnabled() {
        return StripeSecretKeys.isStripeSecretConfigured(StripeSecretKeys.normalize(stripeApiKey));
    }

    @Transactional
    public AccommodationReservationResponse createReservation(AccommodationReservationRequest req) {
        SavedStay s = persistNewReservation(req);
        return mapToResponse(s.reservation(), s.nights(), s.discount());
    }

    /**
     * Creates a PENDING stay reservation, then either returns a local return URL (Stripe off) or hands off to
     * {@link PaymentService#createAccommodationCheckoutSession}.
     */
    @Transactional
    public AccommodationStripeCheckoutHandoff prepareAccommodationStripeCheckout(
            AccommodationReservationRequest req, int authenticatedUserId) {
        if (req.getUserId() != authenticatedUserId) {
            throw new AccessDeniedException("Not your reservation");
        }
        SavedStay s = persistNewReservation(req);
        Reservation saved = s.reservation();
        double total = saved.getTotalPrice() != null ? saved.getTotalPrice() : 0.0;

        if (!isStripeAccommodationPaymentsEnabled()) {
            saved.setStatus(ReservationStatus.CONFIRMED);
            reservationRepository.save(saved);
            return new AccommodationStripeCheckoutHandoff(buildLocalHebergementReturnUrl(saved), null, 0.0);
        }
        return new AccommodationStripeCheckoutHandoff(null, saved, total);
    }

    @Transactional
    public AccommodationReservationResponse confirmAccommodationStripeSession(String sessionId, int userId) {
        if (!isStripeAccommodationPaymentsEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stripe n'est pas activé.");
        }
        Stripe.apiKey = StripeSecretKeys.normalize(stripeApiKey);
        try {
            Session session = Session.retrieve(sessionId);
            String pay = session.getPaymentStatus();
            if (pay == null || !"paid".equalsIgnoreCase(pay)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement Stripe non complété.");
            }
            String rid =
                    session.getMetadata() != null ? session.getMetadata().get("accommodationReservationId") : null;
            if (rid == null || rid.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session Stripe invalide.");
            }
            int reservationId = Integer.parseInt(rid.trim());
            Reservation res = reservationRepository
                    .findByIdWithAssociations(reservationId)
                    .orElseThrow(() -> new ResourceNotFoundException("Réservation introuvable."));
            assertAccommodationOwner(res, userId);
            if (res.getStatus() == ReservationStatus.CONFIRMED) {
                int nights = (int) ChronoUnit.DAYS.between(res.getCheckInDate(), res.getCheckOutDate());
                return mapToResponse(res, nights, 0);
            }
            res.setStatus(ReservationStatus.CONFIRMED);
            Reservation updated = reservationRepository.save(res);
            int nights = (int) ChronoUnit.DAYS.between(updated.getCheckInDate(), updated.getCheckOutDate());
            return mapToResponse(updated, nights, 0);
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Métadonnées Stripe invalides.");
        } catch (StripeException e) {
            log.error("Stripe accommodation session retrieve failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Impossible de valider la session Stripe.");
        }
    }

    private SavedStay persistNewReservation(AccommodationReservationRequest req) {
        if (req.getCheckIn().isAfter(req.getCheckOut())) {
            throw new IllegalArgumentException("La date d'arrivée doit être avant la date de départ.");
        }

        Room room = roomRepository
                .findById(req.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Chambre introuvable."));

        LocalDateTime checkIn = req.getCheckIn().atStartOfDay();
        LocalDateTime checkOut = req.getCheckOut().atStartOfDay();
        // Previous Stripe attempts left PENDING rows that block findAvailableRooms — clear for this user/room/dates.
        reservationRepository.deletePendingOverlappingForUserRoom(req.getUserId(), room.getRoomId(), checkIn, checkOut);

        List<Room> available = roomRepository.findAvailableRooms(
                room.getAccommodation().getAccommodationId(), checkIn, checkOut);
        int rid = room.getRoomId();
        boolean roomListed = available.stream().anyMatch(r -> Objects.equals(r.getRoomId(), rid));
        if (!roomListed) {
            throw new RoomNotAvailableException("La chambre n'est plus disponible pour ces dates.");
        }

        User user = userRepository
                .findById(req.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable."));

        long nights = ChronoUnit.DAYS.between(req.getCheckIn(), req.getCheckOut());
        double totalPrice = room.getPrice() * nights;
        double discount = 0;

        if (req.getOfferId() != null) {
            SpecialOffer offer = specialOfferRepository
                    .findById(req.getOfferId())
                    .orElseThrow(() -> new ResourceNotFoundException("Offre introuvable."));
            discount = totalPrice * (offer.getDiscountPercentage() / 100.0);
            totalPrice -= discount;
        }

        Reservation res = Reservation.builder()
                .checkInDate(req.getCheckIn().atStartOfDay())
                .checkOutDate(req.getCheckOut().atStartOfDay())
                .status(ReservationStatus.PENDING)
                .totalPrice(totalPrice)
                .room(room)
                .user(user)
                .build();

        Reservation saved = reservationRepository.save(res);
        return new SavedStay(saved, (int) nights, discount);
    }

    private String buildLocalHebergementReturnUrl(Reservation r) {
        Integer accId = r.getRoom() != null && r.getRoom().getAccommodation() != null
                ? r.getRoom().getAccommodation().getAccommodationId()
                : 0;
        return "/hebergement/payment/return?local=true&reservationId="
                + r.getReservationId() + "&accommodationId=" + accId;
    }

    private static void assertAccommodationOwner(Reservation res, int userId) {
        if (res.getUser() == null || !res.getUser().getUserId().equals(userId)) {
            throw new AccessDeniedException("Not your reservation");
        }
    }

    @Transactional
    public AccommodationReservationResponse cancelReservation(int id, int userId) {
        Reservation res = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation introuvable."));
        if (res.getUser() == null || !res.getUser().getUserId().equals(userId)) {
            throw new AccessDeniedException("Not your reservation");
        }
        if (res.getStatus() == ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Déjà annulée.");
        }
        if (res.getStatus() == ReservationStatus.CONFIRMED) {
            long hoursUntilCheckIn = ChronoUnit.HOURS.between(LocalDateTime.now(), res.getCheckInDate());
            if (hoursUntilCheckIn < 24) {
                throw new CancellationNotAllowedException("Annulation impossible moins de 24h avant l'arrivée.");
            }
        }

        res.setStatus(ReservationStatus.CANCELLED);
        return mapToResponse(reservationRepository.save(res), 0, 0);
    }

    @Transactional(readOnly = true)
    public List<AccommodationReservationResponse> getUserReservations(int userId) {
        return reservationRepository.findByUser_UserId(userId).stream()
                .filter(r -> r.getStatus() != ReservationStatus.CANCELLED)
                .sorted((a, b) -> b.getCheckInDate().compareTo(a.getCheckInDate()))
                .map(r -> mapToResponse(r, (int) ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate()), 0))
                .collect(Collectors.toList());
    }

    @Transactional
    public AccommodationReservationResponse updateReservation(int reservationId, int userId, AccommodationReservationUpdateRequest req) {
        Reservation res = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation introuvable."));
        if (res.getUser() == null || !res.getUser().getUserId().equals(userId)) {
            throw new AccessDeniedException("Not your reservation");
        }
        if (res.getStatus() == ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Réservation annulée.");
        }
        if (res.getRoom() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Réservation sans chambre.");
        }

        if (req.getCheckIn() == null || req.getCheckOut() == null) {
            throw new IllegalArgumentException("checkIn et checkOut sont requis.");
        }
        if (!req.getCheckIn().isBefore(req.getCheckOut())) {
            throw new IllegalArgumentException("La date d'arrivée doit être avant la date de départ.");
        }

        LocalDateTime ci = req.getCheckIn().atStartOfDay();
        LocalDateTime co = req.getCheckOut().atStartOfDay();

        long conflicts = reservationRepository.countOverlappingExcept(
                res.getRoom().getRoomId(), reservationId, ci, co);
        if (conflicts > 0) {
            throw new RoomNotAvailableException("Ces dates chevauchent une autre réservation pour cette chambre.");
        }

        long nights = ChronoUnit.DAYS.between(req.getCheckIn(), req.getCheckOut());
        double totalPrice = res.getRoom().getPrice() * nights;

        res.setCheckInDate(ci);
        res.setCheckOutDate(co);
        res.setTotalPrice(totalPrice);

        Reservation saved = reservationRepository.save(res);
        return mapToResponse(saved, (int) nights, 0);
    }

    private AccommodationReservationResponse mapToResponse(Reservation r, int nights, double discount) {
        var room = r.getRoom();
        Integer accId = room != null && room.getAccommodation() != null
                ? room.getAccommodation().getAccommodationId()
                : null;
        Integer roomId = room != null ? room.getRoomId() : null;
        return AccommodationReservationResponse.builder()
                .reservationId(r.getReservationId())
                .accommodationId(accId)
                .roomId(roomId)
                .status(r.getStatus().name())
                .checkIn(r.getCheckInDate().toLocalDate())
                .checkOut(r.getCheckOutDate().toLocalDate())
                .nights(nights)
                .totalPrice(r.getTotalPrice())
                .discountApplied(discount)
                .accommodationName(room != null ? room.getAccommodation().getName() : null)
                .roomType(room != null ? room.getRoomType().name() : null)
                .cityName(room != null && room.getAccommodation().getCity() != null
                        ? room.getAccommodation().getCity().getName()
                        : null)
                .build();
    }
}
