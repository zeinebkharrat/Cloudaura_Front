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
import java.util.stream.Stream;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccommodationReservationService {
    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final SpecialOfferRepository specialOfferRepository;
    private final ReservationTranslationHelper reservationLabels;

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
            throw new AccessDeniedException("reservation.error.access_not_owner");
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_not_enabled_accommodation");
        }
        Stripe.apiKey = StripeSecretKeys.normalize(stripeApiKey);
        try {
            Session session = Session.retrieve(sessionId);
            String pay = session.getPaymentStatus();
            if (pay == null || !"paid".equalsIgnoreCase(pay)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_payment_incomplete");
            }
            String rid =
                    session.getMetadata() != null ? session.getMetadata().get("accommodationReservationId") : null;
            if (rid == null || rid.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_invalid_accommodation_session");
            }
            int reservationId = Integer.parseInt(rid.trim());
            Reservation res = reservationRepository
                    .findByIdWithAssociations(reservationId)
                    .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_metadata_invalid");
        } catch (StripeException e) {
            log.error("Stripe accommodation session retrieve failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.error.stripe_verify_failed");
        }
    }

    private SavedStay persistNewReservation(AccommodationReservationRequest req) {
        if (req.getCheckIn().isAfter(req.getCheckOut())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reservation.error.checkin_before_checkout");
        }

        Room room = roomRepository
                .findById(req.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.room_not_found"));

        LocalDateTime checkIn = req.getCheckIn().atStartOfDay();
        LocalDateTime checkOut = req.getCheckOut().atStartOfDay();
        // Previous Stripe attempts left PENDING rows that block findAvailableRooms — clear for this user/room/dates.
        reservationRepository.deletePendingOverlappingForUserRoom(req.getUserId(), room.getRoomId(), checkIn, checkOut);

        List<Room> available = roomRepository.findAvailableRooms(
                room.getAccommodation().getAccommodationId(), checkIn, checkOut);
        int rid = room.getRoomId();
        boolean roomListed = available.stream().anyMatch(r -> Objects.equals(r.getRoomId(), rid));
        if (!roomListed) {
            throw new RoomNotAvailableException("reservation.error.room_unavailable_dates");
        }

        User user = userRepository
                .findById(req.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.user_not_found"));

        long nights = ChronoUnit.DAYS.between(req.getCheckIn(), req.getCheckOut());
        int guests = Math.max(1, req.getGuestCount() == null ? 1 : req.getGuestCount());
        double totalPrice = room.getPrice() * nights * guests;
        double discount = 0;

        if (req.getOfferId() != null) {
            SpecialOffer offer = specialOfferRepository
                    .findById(req.getOfferId())
                    .orElseThrow(() -> new ResourceNotFoundException("reservation.error.offer_not_found"));
            discount = totalPrice * (offer.getDiscountPercentage() / 100.0);
            totalPrice -= discount;
        }

        Reservation res = Reservation.builder()
                .checkInDate(req.getCheckIn().atStartOfDay())
                .checkOutDate(req.getCheckOut().atStartOfDay())
                .status(ReservationStatus.PENDING)
                .totalPrice(totalPrice)
                .guestCount(guests)
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

    private void assertAccommodationOwner(Reservation res, int userId) {
        if (res.getUser() == null || !res.getUser().getUserId().equals(userId)) {
            throw new AccessDeniedException("reservation.error.access_not_owner");
        }
    }

    @Transactional
    public AccommodationReservationResponse cancelReservation(int id, int userId) {
        Reservation res = reservationRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        if (res.getUser() == null || !res.getUser().getUserId().equals(userId)) {
            throw new AccessDeniedException("reservation.error.access_not_owner");
        }
        if (res.getStatus() == ReservationStatus.CANCELLED) {
            return mapToResponse(res, 0, 0);
        }

        LocalDateTime checkInAt = res.getCheckInDate();
        LocalDateTime cancellationDeadline = LocalDateTime.now().plusHours(24);
        if (checkInAt != null && checkInAt.isBefore(cancellationDeadline)) {
            throw new CancellationNotAllowedException("reservation.error.cancellation_window");
        }

        res.setStatus(ReservationStatus.CANCELLED);
        return mapToResponse(reservationRepository.save(res), 0, 0);
    }

    @Transactional(readOnly = true)
    public List<AccommodationReservationResponse> getUserReservations(int userId) {
        return reservationRepository.findByUser_UserId(userId).stream()
                // Keep only accommodation stays; legacy rows can exist with transport-only payloads.
                .filter(r -> r.getRoom() != null)
                .filter(r -> r.getCheckInDate() != null && r.getCheckOutDate() != null)
                .sorted((a, b) -> b.getCheckInDate().compareTo(a.getCheckInDate()))
                .flatMap(r -> {
                    try {
                        return Stream.of(
                                mapToResponse(
                                        r,
                                        (int) ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate()),
                                        0));
                    } catch (Exception ex) {
                        log.warn(
                                "Skip malformed stay reservation id={} for userId={} while loading history: {}",
                                r.getReservationId(),
                                userId,
                                ex.getMessage());
                        return Stream.empty();
                    }
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public AccommodationReservationResponse updateReservation(int reservationId, int userId, AccommodationReservationUpdateRequest req) {
        Reservation res = reservationRepository
                .findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        if (res.getUser() == null || !res.getUser().getUserId().equals(userId)) {
            throw new AccessDeniedException("reservation.error.access_not_owner");
        }
        if (res.getStatus() == ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stay_cancelled");
        }
        if (res.getRoom() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stay_no_room");
        }

        if (req.getCheckIn() == null || req.getCheckOut() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reservation.error.checkin_checkout_required");
        }
        if (!req.getCheckIn().isBefore(req.getCheckOut())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reservation.error.checkin_before_checkout");
        }

        LocalDateTime ci = req.getCheckIn().atStartOfDay();
        LocalDateTime co = req.getCheckOut().atStartOfDay();

        long conflicts = reservationRepository.countOverlappingExcept(
                res.getRoom().getRoomId(), reservationId, ci, co);
        if (conflicts > 0) {
            throw new RoomNotAvailableException("reservation.error.date_overlap_room");
        }

        long nights = ChronoUnit.DAYS.between(req.getCheckIn(), req.getCheckOut());
        int guests = Math.max(1, res.getGuestCount() == null ? 1 : res.getGuestCount());
        double totalPrice = res.getRoom().getPrice() * nights * guests;

        res.setCheckInDate(ci);
        res.setCheckOutDate(co);
        res.setTotalPrice(totalPrice);

        Reservation saved = reservationRepository.save(res);
        return mapToResponse(saved, (int) nights, 0);
    }

    private AccommodationReservationResponse mapToResponse(Reservation r, int nights, double discount) {
        var room = r.getRoom();
        var checkIn = r.getCheckInDate() != null ? r.getCheckInDate().toLocalDate() : null;
        var checkOut = r.getCheckOutDate() != null ? r.getCheckOutDate().toLocalDate() : null;
        Integer accId = room != null && room.getAccommodation() != null
                ? room.getAccommodation().getAccommodationId()
                : null;
        Integer roomId = room != null ? room.getRoomId() : null;
        String accNameRaw =
                room != null && room.getAccommodation() != null && room.getAccommodation().getName() != null
                        ? room.getAccommodation().getName()
                        : null;
        String accName = accId != null
                ? reservationLabels.accommodationName(accId, accNameRaw != null ? accNameRaw : "")
                : (accNameRaw != null ? accNameRaw : null);
        String roomTypeCode = room != null && room.getRoomType() != null ? room.getRoomType().name() : null;
        String roomTypeLabel =
                roomTypeCode != null ? reservationLabels.roomTypeLabel(roomTypeCode) : null;
        String cityName = null;
        if (room != null && room.getAccommodation() != null && room.getAccommodation().getCity() != null) {
            var city = room.getAccommodation().getCity();
            Integer cid = city.getCityId();
            String rawCity = city.getName() != null ? city.getName() : "";
            cityName = cid != null ? reservationLabels.cityName(cid, rawCity) : rawCity;
        }
        return AccommodationReservationResponse.builder()
                .reservationId(r.getReservationId())
                .accommodationId(accId)
                .roomId(roomId)
                .status(r.getStatus() != null ? r.getStatus().name() : ReservationStatus.PENDING.name())
                .statusLabel(reservationLabels.statusLabel(r.getStatus()))
                .checkIn(checkIn)
                .checkOut(checkOut)
                .guestCount(r.getGuestCount() != null ? Math.max(1, r.getGuestCount()) : 1)
                .nights(nights)
                .totalPrice(r.getTotalPrice())
                .discountApplied(discount)
                .accommodationName(accName)
                .nameLabel(accName)
                .roomType(roomTypeCode)
                .roomTypeLabel(roomTypeLabel)
                .cityName(cityName)
                .cityLabel(cityName)
                .build();
    }
}
