package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.transport.SyntheticFlightOfferDto;
import org.example.backend.dto.transport.TransportCheckoutRequest;
import org.example.backend.dto.transport.TransportPayPalCreateRequest;
import org.example.backend.dto.transport.TransportStripeCheckoutHandoff;
import org.example.backend.dto.transport.TransportReservationRequest;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.dto.transport.TransportReservationUpdateRequest;
import org.example.backend.exception.CancellationNotAllowedException;
import org.example.backend.exception.NoSeatsAvailableException;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.example.backend.model.User;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.service.flight.TunisiaAirportIataGovernorateMap;
import org.example.backend.util.StripeSecretKeys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransportReservationService {

    private final TransportReservationRepository reservationRepository;
    private final TransportRepository transportRepository;
    private final CityRepository cityRepository;
    private final UserRepository userRepository;
    private final TransportPricingService transportPricingService;
    private final IPaypalService paypalService;
    private final EmailService emailService;
    private final QrCodeService qrCodeService;
    private final TransportWhatsAppMessageBuilder transportWhatsAppMessageBuilder;
    private final TwilioWhatsAppService twilioWhatsAppService;
    private final UserNotificationService userNotificationService;
    private final TransportReservationMapper transportReservationMapper;
    private final ReservationTranslationHelper reservationLabels;

    @Value("${stripe.api.key:disabled}")
    private String stripeApiKey;

    @Transactional
    public TransportReservationResponse createReservation(TransportReservationRequest req) {
        return createReservationForUser(req, req.getUserId());
    }

    @Transactional
    public TransportReservationResponse createReservationForUser(TransportReservationRequest req, int authenticatedUserId) {
        String pmRaw = req.getPaymentMethod() == null ? "" : req.getPaymentMethod().trim();
        if ("STRIPE".equalsIgnoreCase(pmRaw)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.use_checkout_for_stripe");
        }
        if ("PAYPAL".equalsIgnoreCase(pmRaw)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.use_paypal_endpoint");
        }

        if (reservationRepository.existsByIdempotencyKey(req.getIdempotencyKey())) {
            return reservationRepository
                    .findByIdempotencyKey(req.getIdempotencyKey())
                .map(transportReservationMapper::toResponse)
                    .orElseThrow(
                            () ->
                                    new ResponseStatusException(
                                            HttpStatus.INTERNAL_SERVER_ERROR,
                                            "reservation.error.idempotency_corrupt"));
        }

        Transport transport = resolveTransportForReservation(req);
        assertTransportOpenForBooking(transport, req.getNumberOfSeats());
        validateTaxiRouteKm(transport, req.getRouteKm());

        User user = userRepository
            .findById(authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.user_not_found"));

        LocalDateTime travelDate = resolveTravelDateTime(req.getTravelDate(), transport.getDepartureTime());
        double total = transportPricingService.computeTotalTnd(
            transport,
            req.getNumberOfSeats(),
            req.getRouteKm(),
            req.getRouteDurationMin(),
            req.getRentalDays(),
            travelDate);

        TransportReservation reservation = TransportReservation.builder()
                .status(TransportReservation.ReservationStatus.PENDING)
                .totalPrice(total)
                .travelDate(travelDate)
                .numberOfSeats(req.getNumberOfSeats())
                .passengerFirstName(req.getPassengerFirstName())
                .passengerLastName(req.getPassengerLastName())
                .passengerEmail(req.getPassengerEmail())
                .passengerPhone(req.getPassengerPhone())
                .paymentMethod(TransportReservation.PaymentMethod.valueOf(pmRaw.toUpperCase()))
                .paymentStatus(TransportReservation.PaymentStatus.PENDING)
                .reservationRef("TR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .idempotencyKey(req.getIdempotencyKey())
                .createdAt(LocalDateTime.now())
                .reminderOneHourSent(false)
                .transport(transport)
                .user(user)
                .build();

        if (reservation.getPaymentMethod() == TransportReservation.PaymentMethod.KONNECT) {
            log.info("KONNECT payment initiated for ref: {}", reservation.getReservationRef());
            reservation.setPaymentStatus(TransportReservation.PaymentStatus.PAID);
            reservation.setStatus(TransportReservation.ReservationStatus.CONFIRMED);
        }

        TransportReservation saved = reservationRepository.save(reservation);
        userNotificationService.notifyReservation(
            user.getUserId(),
            "TRANSPORT", 
            saved.getTransportReservationId(), 
            "Transport reservation created", 
            "Your transport reservation " + safeRef(saved.getReservationRef()) + " was created.", 
            "/mes-reservations" 
        );
        if (saved.getPaymentMethod() == TransportReservation.PaymentMethod.KONNECT
                && saved.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
            sendTransportConfirmationWhatsAppSafely(saved);
        }

        return transportReservationMapper.toResponse(saved);
    }

    /**
     * Prepares a PENDING STRIPE reservation (unless idempotency replay). Caller uses
     * {@link PaymentService#createTransportCheckoutSession} when {@link TransportStripeCheckoutHandoff#localSimulationUrl()}
     * is {@code null}.
     */
    @Transactional
    public TransportStripeCheckoutHandoff prepareTransportStripeCheckoutHandoff(
            TransportCheckoutRequest req, int authenticatedUserId) {
        Optional<TransportReservation> existingOpt = reservationRepository.findByIdempotencyKey(req.getIdempotencyKey());
        if (existingOpt.isPresent()) {
            TransportReservation existing = existingOpt.get();
            assertReservationOwner(existing, authenticatedUserId);
            if (existing.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
                double total = existing.getTotalPrice() != null ? existing.getTotalPrice() : 0.0;
                return new TransportStripeCheckoutHandoff(buildLocalPaymentReturnUrl(existing), existing, total);
            }
            if (!isStripeTransportPaymentsEnabled()) {
                applyPaidAndConfirmed(existing);
                existing = reservationRepository.save(existing);
                Integer ownerId = existing.getUser() != null ? existing.getUser().getUserId() : null;
                userNotificationService.notifyReservation(
                        ownerId,
                        "TRANSPORT",
                        existing.getTransportReservationId(),
                        "Transport reservation confirmed",
                        "Your transport reservation " + safeRef(existing.getReservationRef()) + " is confirmed.",
                        "/mes-reservations"
                );
                sendTransportConfirmationWhatsAppSafely(existing);
                return new TransportStripeCheckoutHandoff(buildLocalPaymentReturnUrl(existing), null, 0.0);
            }
            double total = existing.getTotalPrice() != null ? existing.getTotalPrice() : 0.0;
            return new TransportStripeCheckoutHandoff(null, existing, total);
        }

        Transport transport = resolveTransportForCheckout(req);
        assertTransportOpenForBooking(transport, req.getNumberOfSeats());
        validateTaxiRouteKm(transport, req.getRouteKm());

        User user = userRepository
                .findById(authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.user_not_found"));

        LocalDateTime travelDate = resolveTravelDateTime(req.getTravelDate(), transport.getDepartureTime());
        double total = transportPricingService.computeTotalTnd(
            transport,
            req.getNumberOfSeats(),
            req.getRouteKm(),
            req.getRouteDurationMin(),
            req.getRentalDays(),
            travelDate);

        TransportReservation reservation = TransportReservation.builder()
                .status(TransportReservation.ReservationStatus.PENDING)
                .totalPrice(total)
                .travelDate(travelDate)
                .numberOfSeats(req.getNumberOfSeats())
                .passengerFirstName(req.getPassengerFirstName().trim())
                .passengerLastName(req.getPassengerLastName().trim())
                .passengerEmail(req.getPassengerEmail().trim())
                .passengerPhone(req.getPassengerPhone().trim())
                .paymentMethod(TransportReservation.PaymentMethod.STRIPE)
                .paymentStatus(TransportReservation.PaymentStatus.PENDING)
                .reservationRef("TR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .idempotencyKey(req.getIdempotencyKey())
                .createdAt(LocalDateTime.now())
                .reminderOneHourSent(false)
                .transport(transport)
                .user(user)
                .build();

        reservation = reservationRepository.save(reservation);

        if (!isStripeTransportPaymentsEnabled()) {
            applyPaidAndConfirmed(reservation);
            reservation = reservationRepository.save(reservation);
            Integer ownerId = reservation.getUser() != null ? reservation.getUser().getUserId() : null;
            userNotificationService.notifyReservation(
                    ownerId,
                    "TRANSPORT",
                    reservation.getTransportReservationId(),
                    "Transport reservation confirmed",
                    "Your transport reservation " + safeRef(reservation.getReservationRef()) + " is confirmed.",
                    "/mes-reservations"
            );
            sendTransportConfirmationWhatsAppSafely(reservation);
            return new TransportStripeCheckoutHandoff(buildLocalPaymentReturnUrl(reservation), null, 0.0);
        }

        return new TransportStripeCheckoutHandoff(null, reservation, total);
    }

    @Transactional
    public TransportReservation createPendingPayPalReservation(int userId, TransportPayPalCreateRequest req) {
        Transport transport = resolveTransportForPayPal(req);
        assertTransportOpenForBooking(transport, req.getSeats());
        validateTaxiRouteKm(transport, req.getRouteKm());

        Integer rentalDays = transport.getType() == Transport.TransportType.CAR ? 1 : null;
        LocalDateTime travelDate = resolveTravelDateTime(req.getTravelDate(), transport.getDepartureTime());
        double serverTotal =
            transportPricingService.computeTotalTnd(
                transport,
                req.getSeats(),
                req.getRouteKm(),
                req.getRouteDurationMin(),
                rentalDays,
                travelDate);
        if (Math.abs(serverTotal - req.getAmountTnd()) > 0.05) {
            log.warn(
                    "PayPal amount mismatch: client amountTnd={} serverTotal={} transportId={}",
                    req.getAmountTnd(),
                    serverTotal,
                    req.getTransportId());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.paypal_amount_mismatch");
        }

        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.user_not_found"));

        String fn = req.getPassengerFirstName() != null && !req.getPassengerFirstName().isBlank()
                ? req.getPassengerFirstName().trim()
                : (user.getFirstName() != null && !user.getFirstName().isBlank()
                        ? user.getFirstName().trim()
                        : "Traveler");
        String ln = req.getPassengerLastName() != null && !req.getPassengerLastName().isBlank()
                ? req.getPassengerLastName().trim()
                : (user.getLastName() != null && !user.getLastName().isBlank() ? user.getLastName().trim() : "");
        String email = req.getPassengerEmail() != null && !req.getPassengerEmail().isBlank()
                ? req.getPassengerEmail().trim()
                : (user.getEmail() != null ? user.getEmail().trim() : "");
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.email_required_paypal");
        }
        String phone = req.getPassengerPhone() != null && !req.getPassengerPhone().isBlank()
                ? req.getPassengerPhone().trim()
                : user.getPhone();
        if (phone == null || phone.isBlank()) {
            phone = "+216 00000000";
        }

        TransportReservation reservation = TransportReservation.builder()
                .status(TransportReservation.ReservationStatus.PENDING)
                .totalPrice(serverTotal)
                .travelDate(travelDate)
                .numberOfSeats(req.getSeats())
                .passengerFirstName(fn)
                .passengerLastName(ln)
                .passengerEmail(email)
                .passengerPhone(phone)
                .paymentMethod(TransportReservation.PaymentMethod.PAYPAL)
                .paymentStatus(TransportReservation.PaymentStatus.PENDING)
                .reservationRef("TR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .idempotencyKey(UUID.randomUUID().toString())
                .createdAt(LocalDateTime.now())
                .reminderOneHourSent(false)
                .transport(transport)
                .user(user)
                .build();

        reservation = reservationRepository.save(reservation);
        log.info(
                "PayPal PENDING transport reservation saved: id={} ref={} totalTnd={}",
                reservation.getTransportReservationId(),
                reservation.getReservationRef(),
                serverTotal);
        return reservation;
    }

    @Transactional
    public TransportReservationResponse confirmTransportPayPalCapture(String payPalOrderId, int reservationId, int userId) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        assertReservationOwner(res, userId);
        if (res.getPaymentMethod() != TransportReservation.PaymentMethod.PAYPAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.not_paypal_reservation");
        }
        if (res.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
            log.info("PayPal capture skipped (already CONFIRMED): reservationId={}", reservationId); 
            return transportReservationMapper.toResponse(res);
        }

        Map<String, Object> captureResponse;
        try {
            captureResponse = paypalService.captureOrder(payPalOrderId);
        } catch (IllegalStateException e) {
            log.error("PayPal capture API error reservationId={} orderId={}", reservationId, payPalOrderId, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.error.paypal_finalize_failed");
        }

        String status =
                captureResponse.get("status") != null ? captureResponse.get("status").toString() : "";
        if (!"COMPLETED".equalsIgnoreCase(status)) {
            log.warn(
                    "PayPal capture not completed: reservationId={} orderId={} status={}",
                    reservationId,
                    payPalOrderId,
                    status);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.paypal_capture_incomplete");
        }

        applyPaidAndConfirmed(res);
        res = reservationRepository.save(res);
        Integer ownerId = res.getUser() != null ? res.getUser().getUserId() : null;
        userNotificationService.notifyReservation(
            ownerId,
            "TRANSPORT",
            res.getTransportReservationId(),
            "Transport reservation confirmed",
            "Your transport reservation " + safeRef(res.getReservationRef()) + " is confirmed.",
            "/mes-reservations"
        );
        log.info(
                "PayPal transport reservation CONFIRMED: reservationId={} orderId={}; 1h reminder eligible via scheduler",
                reservationId,
                payPalOrderId);

        sendTransportPayPalConfirmationEmail(res);

        TransportReservation loaded = reservationRepository
                .findByIdWithAssociations(res.getTransportReservationId())
                .orElse(res);
        return transportReservationMapper.toResponse(loaded);
    }

    private void sendTransportPayPalConfirmationEmail(TransportReservation res) {
        try {
            TransportReservation full = reservationRepository
                    .findByIdWithAssociations(res.getTransportReservationId())
                    .orElse(res);
            String to = full.getPassengerEmail();
            if (to == null || to.isBlank()) {
                log.warn("PayPal confirmation email skipped: no passenger email reservationId={}", full.getTransportReservationId());
                return;
            }
            String route = buildRouteLabelForEmail(full);
            String amountStr = full.getTotalPrice() != null ? String.format(java.util.Locale.US, "%.2f", full.getTotalPrice()) : "0.00";
            String qrJson = TransportTicketQrPayload.jsonForReservation(full);
            byte[] qrPng = qrCodeService.generateQrPng(qrJson, 280);
            emailService.sendTransportBookingConfirmation(
                    to.trim(),
                    full.getPassengerFirstName(),
                    full.getReservationRef() != null ? full.getReservationRef() : "",
                    route,
                    amountStr,
                    qrPng);
            log.info("PayPal transport confirmation email sent reservationId={}", full.getTransportReservationId());
        } catch (Exception e) {
            log.error("PayPal transport confirmation email failed reservationId={}", res.getTransportReservationId(), e);
        }
        sendTransportConfirmationWhatsAppSafely(res);
    }

    private static String buildRouteLabelForEmail(TransportReservation r) {
        if (r.getTransport() == null) {
            return "";
        }
        String a = r.getTransport().getDepartureCity() != null && r.getTransport().getDepartureCity().getName() != null
                ? r.getTransport().getDepartureCity().getName()
                : "";
        String b = r.getTransport().getArrivalCity() != null && r.getTransport().getArrivalCity().getName() != null
                ? r.getTransport().getArrivalCity().getName()
                : "";
        return a + " → " + b;
    }

    @Transactional
    public TransportReservationResponse confirmTransportStripeSession(String sessionId, int userId) {
        if (!isStripeTransportPaymentsEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_disabled");
        }
        Stripe.apiKey = StripeSecretKeys.resolveEffective(stripeApiKey, System.getenv("STRIPE_SECRET_KEY"));
        try {
            Session session = Session.retrieve(sessionId);
            String pay = session.getPaymentStatus();
            if (pay == null || !"paid".equalsIgnoreCase(pay)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_payment_incomplete");
            }
            String rid = session.getMetadata() != null ? session.getMetadata().get("transportReservationId") : null;
            if (rid == null || rid.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_session_invalid");
            }
            int reservationId = Integer.parseInt(rid.trim());
            TransportReservation res = reservationRepository
                    .findByIdWithAssociations(reservationId)
                    .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
            assertReservationOwner(res, userId);
            if (res.getPaymentMethod() != TransportReservation.PaymentMethod.STRIPE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.not_stripe_reservation");
            }
            if (res.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
                return transportReservationMapper.toResponse(res);
            }
            applyPaidAndConfirmed(res);
            res = reservationRepository.save(res);
                Integer ownerId = res.getUser() != null ? res.getUser().getUserId() : null;
                userNotificationService.notifyReservation(
                    ownerId,
                    "TRANSPORT",
                    res.getTransportReservationId(),
                    "Transport reservation confirmed",
                    "Your transport reservation " + safeRef(res.getReservationRef()) + " is confirmed.",
                    "/mes-reservations"
                );
            sendTransportConfirmationWhatsAppSafely(res);
            return transportReservationMapper.toResponse(res);
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.stripe_metadata_invalid");
        } catch (StripeException e) {
            log.error("Stripe session retrieve failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.error.stripe_verify_failed");
        }
    }

    @Transactional
    public TransportReservationResponse cancelReservation(int id, int userId) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(id)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        assertReservationOwner(res, userId);
        if (res.getStatus() == TransportReservation.ReservationStatus.CANCELLED) {
            return transportReservationMapper.toResponse(res);
        }

        LocalDateTime startAt = resolveTransportStartDateTime(res); 
        LocalDateTime cancellationDeadline = LocalDateTime.now().plusHours(24);
        if (startAt != null && startAt.isBefore(cancellationDeadline)) {
            throw new CancellationNotAllowedException("reservation.error.cancellation_window_transport");
        }

        res.setStatus(TransportReservation.ReservationStatus.CANCELLED);
        if (res.getPaymentStatus() == TransportReservation.PaymentStatus.PAID) {
            res.setPaymentStatus(TransportReservation.PaymentStatus.REFUNDED);
        }

        return transportReservationMapper.toResponse(reservationRepository.save(res));
    }

    @Transactional(readOnly = true)
    public List<TransportReservationResponse> getUserReservations(int userId) {
        return reservationRepository.findByUserIdWithAssociations(userId).stream()
                .filter(r -> r.getStatus() != TransportReservation.ReservationStatus.CANCELLED)
                .sorted(Comparator.comparing(
                        TransportReservation::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .flatMap(r -> {
                    try {
                        return Stream.of(transportReservationMapper.toResponse(r)); 
                    } catch (Exception e) {
                        log.warn("Skip transport reservation {} due to mapping/load error: {}",
                                r.getTransportReservationId(), e.getMessage());
                        return Stream.empty();
                    }
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TransportReservationResponse getReservationForUser(int reservationId, int userId) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        assertReservationOwner(res, userId);
        return transportReservationMapper.toResponse(res);
    }

    @Transactional
    public TransportReservationResponse updateReservation(int reservationId, int userId, TransportReservationUpdateRequest req) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        assertReservationOwner(res, userId);
        if (res.getStatus() == TransportReservation.ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.cannot_modify_cancelled");
        }

        Transport transport = res.getTransport();
        if (transport == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.transport_missing_for_reservation");
        }
        Integer transportId = transport.getTransportId();
        Integer capacity = transport.getCapacity();
        if (transportId == null || capacity == null || capacity < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.transport_incomplete");
        }

        Integer reqSeats = req.getNumberOfSeats();
        Integer resSeats = res.getNumberOfSeats();
        int newSeats = reqSeats != null ? reqSeats : (resSeats != null ? resSeats : 1);
        if (newSeats < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.invalid_seat_count");
        }

        int booked = reservationRepository.countBookedSeats(transportId);
        int currentHeld = resSeats != null ? resSeats : 0;
        int availableForChange = capacity - booked + currentHeld;
        if (newSeats > availableForChange) {
            throw new NoSeatsAvailableException("reservation.error.no_seats_for_trip");
        }

        if (req.getNumberOfSeats() != null) {
            res.setNumberOfSeats(newSeats);
            double unit = transport.getPrice() != null ? transport.getPrice() : 0.0;
            res.setTotalPrice(unit * newSeats);
        }

        if (req.getPassengerFirstName() != null && !req.getPassengerFirstName().isBlank()) {
            res.setPassengerFirstName(req.getPassengerFirstName().trim());
        }
        if (req.getPassengerLastName() != null && !req.getPassengerLastName().isBlank()) {
            res.setPassengerLastName(req.getPassengerLastName().trim());
        }
        if (req.getPassengerEmail() != null && !req.getPassengerEmail().isBlank()) {
            res.setPassengerEmail(req.getPassengerEmail().trim());
        }
        if (req.getPassengerPhone() != null && !req.getPassengerPhone().isBlank()) {
            res.setPassengerPhone(req.getPassengerPhone().trim());
        }

        TransportReservation.ReservationStatus statusBeforePaymentChange = res.getStatus();
        boolean konnectJustConfirmed = false;
        if (req.getPaymentMethod() != null && !req.getPaymentMethod().isBlank()) {
            String pm = req.getPaymentMethod().trim();
            if ("STRIPE".equalsIgnoreCase(pm)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.use_checkout_for_stripe");
            }
            if ("PAYPAL".equalsIgnoreCase(pm)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.use_paypal_endpoint");
            }
            TransportReservation.PaymentMethod pme = TransportReservation.PaymentMethod.valueOf(pm.toUpperCase());
            res.setPaymentMethod(pme);
            if (pme == TransportReservation.PaymentMethod.KONNECT) {
                res.setPaymentStatus(TransportReservation.PaymentStatus.PAID);
                res.setStatus(TransportReservation.ReservationStatus.CONFIRMED);
                konnectJustConfirmed = statusBeforePaymentChange != TransportReservation.ReservationStatus.CONFIRMED;
            }
        }

        TransportReservation updated = reservationRepository.save(res);
        if (konnectJustConfirmed && updated.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
            sendTransportConfirmationWhatsAppSafely(updated);
        }
        return transportReservationMapper.toResponse(updated);
    }

    /**
     * Real Stripe Checkout when {@code stripe.api.key} normalizes to {@code sk_test_…} or {@code sk_live_…}
     * (leading/trailing whitespace and UTF-8 BOM are stripped so valid keys are not misclassified).
     */
    public boolean isStripeTransportPaymentsEnabled() {
        String effective = StripeSecretKeys.resolveEffective(stripeApiKey, System.getenv("STRIPE_SECRET_KEY"));
        return StripeSecretKeys.isStripeSecretConfigured(effective);
    }

    public void sendTransportConfirmationWhatsApp(TransportReservation reservation) {
        sendTransportConfirmationWhatsAppSafely(reservation);
    }

    private void sendTransportConfirmationWhatsAppSafely(TransportReservation res) {
        try {
            if (res == null || res.getTransportReservationId() == null) {
                return;
            }
            TransportReservation full =
                    reservationRepository.findByIdWithAssociations(res.getTransportReservationId()).orElse(res);
            String msg = transportWhatsAppMessageBuilder.buildConfirmationMessage(full);
                String toPhone = (full.getPassengerPhone() != null && !full.getPassengerPhone().isBlank())
                    ? full.getPassengerPhone()
                    : (full.getUser() != null ? full.getUser().getPhone() : null);
            twilioWhatsAppService.sendWhatsApp(
                    toPhone, msg);
        } catch (Exception e) {
            log.warn("WhatsApp confirmation skipped: {}", e.getMessage());
        }
    }

    private void applyPaidAndConfirmed(TransportReservation r) {
        r.setPaymentStatus(TransportReservation.PaymentStatus.PAID);
        r.setStatus(TransportReservation.ReservationStatus.CONFIRMED);
    }

    private String buildLocalPaymentReturnUrl(TransportReservation r) {
        int tid = r.getTransport() != null && r.getTransport().getTransportId() != null
                ? r.getTransport().getTransportId()
                : 0;
        return "/transport/payment/return?local=true&reservationId="
                + r.getTransportReservationId() + "&transportId=" + tid;
    }

    /**
     * Avoids NPE on legacy rows: {@code isActive == null} is treated as active; {@code capacity} / {@code transportId}
     * must be set to accept bookings.
     */
    private void assertTransportOpenForBooking(Transport transport, int seatsRequested) {
        Integer tid = transport.getTransportId();
        if (tid == null) {
            throw new ResourceNotFoundException("reservation.error.transport_invalid");
        }
        if (Boolean.FALSE.equals(transport.getIsActive())) {
            throw new ResourceNotFoundException("reservation.error.transport_inactive");
        }
        Integer cap = transport.getCapacity();
        if (cap == null || cap < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.transport_capacity_missing");
        }
        int booked = reservationRepository.countBookedSeats(tid);
        if (booked + seatsRequested > cap) {
            throw new NoSeatsAvailableException("reservation.error.no_seats_for_trip");
        }
    }

    private void validateTaxiRouteKm(Transport transport, Double routeKm) {
        if (transport.getType() == Transport.TransportType.TAXI) {
            if (routeKm == null || routeKm <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.taxi_km_required");
            }
        }
    }

    private LocalDateTime resolveTravelDateTime(String travelDateIso, LocalDateTime fallback) {
        if (travelDateIso == null || travelDateIso.isBlank()) {
            return fallback;
        }
        String t = travelDateIso.trim();
        try {
            if (t.contains("T")) {
                return LocalDateTime.parse(t, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            LocalDate date = LocalDate.parse(t, DateTimeFormatter.ISO_LOCAL_DATE);
            if (fallback != null) {
                return LocalDateTime.of(date, fallback.toLocalTime());
            }
            return date.atStartOfDay();
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.invalid_travel_date");
        }
    }

    private void assertReservationOwner(TransportReservation res, int userId) {
        Integer ownerId = res.getUser() != null ? res.getUser().getUserId() : null;
        if (!Objects.equals(ownerId, userId)) {
            throw new AccessDeniedException("reservation.error.access_not_owner");
        }
    }

    private String safeRef(String reservationRef) {
        return reservationRef == null || reservationRef.isBlank() ? "(n/a)" : reservationRef;
    }

    private Transport resolveTransportForCheckout(TransportCheckoutRequest req) {
        return resolveTransportByIdAndOffer(req.getTransportId(), req.getSyntheticFlightOffer(), req.getTravelDate());
    }

    private Transport resolveTransportForPayPal(TransportPayPalCreateRequest req) {
        return resolveTransportByIdAndOffer(req.getTransportId(), req.getSyntheticFlightOffer(), req.getTravelDate());
    }

    private Transport resolveTransportForReservation(TransportReservationRequest req) {
        return resolveTransportByIdAndOffer(req.getTransportId(), req.getSyntheticFlightOffer(), req.getTravelDate());
    }

    private Transport resolveTransportByIdAndOffer(
            Integer transportId, SyntheticFlightOfferDto offer, String travelDate) {
        if (transportId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.transport_not_found");
        }
        if (transportId > 0) {
            return transportRepository
                    .findById(transportId)
                    .orElseThrow(() -> new ResourceNotFoundException("reservation.error.transport_not_found"));
        }
        if (transportId < 0) {
            if (offer == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "reservation.error.synthetic_flight_offer_required");
            }
            return materializeSyntheticPlaneFromOffer(offer, travelDate);
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.transport_not_found");
    }

    private Transport materializeSyntheticPlaneFromOffer(SyntheticFlightOfferDto offer, String travelDateParam) {
        String di = offer.getDepartureIata().trim().toUpperCase(Locale.ROOT);
        String ai = offer.getArrivalIata().trim().toUpperCase(Locale.ROOT);
        if (di.equals(ai)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.same_airport_route");
        }
        City depCity = resolveCityForAirport(di);
        City arrCity = resolveCityForAirport(ai);

        LocalDateTime dep =
                parseOfferEndpointDateTime(offer.getDepartureTimeIso(), travelDateParam, LocalDateTime.now());
        LocalDateTime arr =
                parseOfferEndpointDateTime(offer.getArrivalTimeIso(), travelDateParam, dep.plusHours(2));
        if (!arr.isAfter(dep)) {
            arr = dep.plusHours(2);
        }

        double price = offer.getPricePerSeatTnd() != null ? offer.getPricePerSeatTnd() : 0.0;
        if (price <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.price_invalid");
        }
        String op = offer.getOperatorName() != null ? offer.getOperatorName().trim() : "";
        if (op.isEmpty()) {
            op = "Airline";
        }
        String desc = offer.getDescription();
        if (desc == null || desc.isBlank()) {
            desc = "Flight " + di + " → " + ai;
        }
        if (desc.length() > 2000) {
            desc = desc.substring(0, 2000);
        }
        String fc = offer.getFlightCode();
        if (fc != null && fc.length() > 20) {
            fc = fc.substring(0, 20);
        }

        Transport t =
                Transport.builder()
                        .type(Transport.TransportType.PLANE)
                        .departureCity(depCity)
                        .arrivalCity(arrCity)
                        .departureTime(dep)
                        .arrivalTime(arr)
                        .capacity(180)
                        .price(price)
                        .operatorName(op)
                        .flightCode(fc != null && !fc.isBlank() ? fc.trim() : null)
                        .description(desc)
                        .isActive(true)
                        .createdAt(LocalDateTime.now())
                        .build();
        return transportRepository.save(t);
    }

    private City resolveCityForAirport(String iataCode) {
        if (iataCode == null || iataCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.invalid_airport_code");
        }
        String iata = iataCode.trim().toUpperCase(Locale.ROOT);
        Optional<String> gov = TunisiaAirportIataGovernorateMap.governorateNameForIata(iata);
        if (gov.isPresent()) {
            return cityRepository
                    .findFirstByNameIgnoreCase(gov.get())
                    .orElseThrow(
                            () ->
                                    new ResponseStatusException(
                                            HttpStatus.INTERNAL_SERVER_ERROR, "reservation.error.city_not_seeded"));
        }
        return ensureInternationalAirportCity(iata);
    }

    private City ensureInternationalAirportCity(String iata) {
        String label = "Airport " + iata;
        Optional<City> existing = cityRepository.findFirstByNameIgnoreCase(label);
        if (existing.isPresent()) {
            return existing.get();
        }
        City c = new City();
        c.setName(label);
        c.setRegion("International");
        c.setDescription("Auto-created airport anchor for flight checkout (" + iata + ").");
        c.setHasAirport(true);
        c.setHasBusStation(false);
        c.setHasTrainStation(false);
        c.setHasPort(false);
        return cityRepository.save(c);
    }

    private LocalDateTime parseOfferEndpointDateTime(
            String iso, String travelDateFallback, LocalDateTime fallbackHint) {
        LocalDateTime fromIso = tryParseFlightIso(iso);
        if (fromIso != null) {
            return fromIso;
        }
        if (travelDateFallback != null && !travelDateFallback.isBlank()) {
            return resolveTravelDateTime(travelDateFallback, fallbackHint);
        }
        if (fallbackHint != null) {
            return fallbackHint;
        }
        return LocalDateTime.now();
    }

    private LocalDateTime tryParseFlightIso(String iso) {
        if (iso == null || iso.isBlank()) {
            return null;
        }
        String t = iso.trim();
        try {
            return LocalDateTime.parse(t, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(t).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDateTime.parse(t, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalDateTime resolveTransportStartDateTime(TransportReservation reservation) {
        if (reservation == null) {
            return null;
        }
        // Use booked departure datetime first (reservation-level), then fallback to transport schedule.
        if (reservation.getTravelDate() != null) {
            return reservation.getTravelDate();
        }
        if (reservation.getTransport() != null && reservation.getTransport().getDepartureTime() != null) {
            return reservation.getTransport().getDepartureTime();
        }
        return null;
    }
}
