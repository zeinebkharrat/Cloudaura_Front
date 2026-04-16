package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.transport.TransportCheckoutRequest;
import org.example.backend.dto.transport.TransportPayPalCreateRequest;
import org.example.backend.dto.transport.TransportStripeCheckoutHandoff;
import org.example.backend.dto.transport.TransportReservationRequest;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.dto.transport.TransportReservationUpdateRequest;
import org.example.backend.exception.NoSeatsAvailableException;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.example.backend.model.User;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final TransportPricingService transportPricingService;
    private final IPaypalService paypalService;
    private final EmailService emailService;
    private final QrCodeService qrCodeService;
    private final TransportWhatsAppMessageBuilder transportWhatsAppMessageBuilder;
    private final TwilioWhatsAppService twilioWhatsAppService;
    private final UserNotificationService userNotificationService;

    @Value("${stripe.api.key:disabled}")
    private String stripeApiKey;

    @Transactional
    public TransportReservationResponse createReservation(TransportReservationRequest req) {
        String pmRaw = req.getPaymentMethod() == null ? "" : req.getPaymentMethod().trim();
        if ("STRIPE".equalsIgnoreCase(pmRaw)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Utilisez POST /api/transport/payments/checkout-session pour payer par carte.");
        }
        if ("PAYPAL".equalsIgnoreCase(pmRaw)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Utilisez POST /api/transport/payments/paypal/create pour payer via PayPal.");
        }

        if (reservationRepository.existsByIdempotencyKey(req.getIdempotencyKey())) {
            return reservationRepository
                    .findByIdempotencyKey(req.getIdempotencyKey())
                    .map(TransportReservationMapper::toResponse)
                    .orElseThrow(() -> new RuntimeException("Erreur idempotence : clé existante mais réservation introuvable."));
        }

        Transport transport = transportRepository
                .findById(req.getTransportId())
                .orElseThrow(() -> new ResourceNotFoundException("Transport non trouvé."));
        assertTransportOpenForBooking(transport, req.getNumberOfSeats());
        validateTaxiRouteKm(transport, req.getRouteKm());

        User user = userRepository
                .findById(req.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé."));

        LocalDateTime travelDate = resolveTravelDateTime(req.getTravelDate(), transport.getDepartureTime());
        double total = transportPricingService.computeTotalTnd(
                transport, req.getNumberOfSeats(), req.getRouteKm(), req.getRentalDays());

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

        return TransportReservationMapper.toResponse(saved);
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
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette réservation est déjà confirmée.");
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

        Transport transport = transportRepository
                .findById(req.getTransportId())
                .orElseThrow(() -> new ResourceNotFoundException("Transport non trouvé."));
        assertTransportOpenForBooking(transport, req.getNumberOfSeats());
        validateTaxiRouteKm(transport, req.getRouteKm());

        User user = userRepository
                .findById(authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé."));

        LocalDateTime travelDate = resolveTravelDateTime(req.getTravelDate(), transport.getDepartureTime());
        double total = transportPricingService.computeTotalTnd(
                transport, req.getNumberOfSeats(), req.getRouteKm(), req.getRentalDays());

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
        Transport transport =
                transportRepository.findById(req.getTransportId()).orElseThrow(() -> new ResourceNotFoundException("Transport non trouvé."));
        assertTransportOpenForBooking(transport, req.getSeats());
        validateTaxiRouteKm(transport, req.getRouteKm());

        Integer rentalDays = transport.getType() == Transport.TransportType.CAR ? 1 : null;
        double serverTotal =
                transportPricingService.computeTotalTnd(transport, req.getSeats(), req.getRouteKm(), rentalDays);
        if (Math.abs(serverTotal - req.getAmountTnd()) > 0.05) {
            log.warn(
                    "PayPal amount mismatch: client amountTnd={} serverTotal={} transportId={}",
                    req.getAmountTnd(),
                    serverTotal,
                    req.getTransportId());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Montant incohérent avec le tarif affiché.");
        }

        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé."));

        LocalDateTime travelDate = resolveTravelDateTime(req.getTravelDate(), transport.getDepartureTime());

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
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Un e-mail est requis pour payer avec PayPal.");
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
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, userId);
        if (res.getPaymentMethod() != TransportReservation.PaymentMethod.PAYPAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette réservation n'est pas un paiement PayPal.");
        }
        if (res.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
            log.info("PayPal capture skipped (already CONFIRMED): reservationId={}", reservationId);
            return TransportReservationMapper.toResponse(res);
        }

        Map<String, Object> captureResponse;
        try {
            captureResponse = paypalService.captureOrder(payPalOrderId);
        } catch (IllegalStateException e) {
            log.error("PayPal capture API error reservationId={} orderId={}", reservationId, payPalOrderId, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Impossible de finaliser le paiement PayPal.");
        }

        String status =
                captureResponse.get("status") != null ? captureResponse.get("status").toString() : "";
        if (!"COMPLETED".equalsIgnoreCase(status)) {
            log.warn(
                    "PayPal capture not completed: reservationId={} orderId={} status={}",
                    reservationId,
                    payPalOrderId,
                    status);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "FAILED");
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
        return TransportReservationMapper.toResponse(loaded);
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stripe n'est pas activé.");
        }
        Stripe.apiKey = StripeSecretKeys.normalize(stripeApiKey);
        try {
            Session session = Session.retrieve(sessionId);
            String pay = session.getPaymentStatus();
            if (pay == null || !"paid".equalsIgnoreCase(pay)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement Stripe non complété.");
            }
            String rid = session.getMetadata() != null ? session.getMetadata().get("transportReservationId") : null;
            if (rid == null || rid.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session Stripe invalide.");
            }
            int reservationId = Integer.parseInt(rid.trim());
            TransportReservation res = reservationRepository
                    .findByIdWithAssociations(reservationId)
                    .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
            assertReservationOwner(res, userId);
            if (res.getPaymentMethod() != TransportReservation.PaymentMethod.STRIPE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette réservation n'est pas un paiement Stripe.");
            }
            if (res.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
                return TransportReservationMapper.toResponse(res);
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
            return TransportReservationMapper.toResponse(res);
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Métadonnées Stripe invalides.");
        } catch (StripeException e) {
            log.error("Stripe session retrieve failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Impossible de valider la session Stripe.");
        }
    }

    @Transactional
    public TransportReservationResponse cancelReservation(int id, int userId) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(id)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, userId);
        if (res.getStatus() == TransportReservation.ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Déjà annulée.");
        }

        res.setStatus(TransportReservation.ReservationStatus.CANCELLED);
        if (res.getPaymentStatus() == TransportReservation.PaymentStatus.PAID) {
            res.setPaymentStatus(TransportReservation.PaymentStatus.REFUNDED);
        }

        return TransportReservationMapper.toResponse(reservationRepository.save(res));
    }

    @Transactional(readOnly = true)
    public List<TransportReservationResponse> getUserReservations(int userId) {
        return reservationRepository.findByUser_UserId(userId).stream()
                .filter(r -> r.getStatus() != TransportReservation.ReservationStatus.CANCELLED)
                .sorted(Comparator.comparing(
                        TransportReservation::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .flatMap(r -> {
                    try {
                        return Stream.of(TransportReservationMapper.toResponse(r));
                    } catch (ResourceNotFoundException e) {
                        log.warn("Skip transport reservation {}: {}", r.getTransportReservationId(), e.getMessage());
                        return Stream.empty();
                    }
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TransportReservationResponse getReservationForUser(int reservationId, int userId) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, userId);
        return TransportReservationMapper.toResponse(res);
    }

    @Transactional
    public TransportReservationResponse updateReservation(int reservationId, int userId, TransportReservationUpdateRequest req) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, userId);
        if (res.getStatus() == TransportReservation.ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Réservation annulée — impossible de modifier.");
        }

        Transport transport = res.getTransport();
        if (transport == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transport associé introuvable.");
        }
        Integer transportId = transport.getTransportId();
        Integer capacity = transport.getCapacity();
        if (transportId == null || capacity == null || capacity < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Données transport incomplètes pour cette réservation.");
        }

        Integer reqSeats = req.getNumberOfSeats();
        Integer resSeats = res.getNumberOfSeats();
        int newSeats = reqSeats != null ? reqSeats : (resSeats != null ? resSeats : 1);
        if (newSeats < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de places invalide.");
        }

        int booked = reservationRepository.countBookedSeats(transportId);
        int currentHeld = resSeats != null ? resSeats : 0;
        int availableForChange = capacity - booked + currentHeld;
        if (newSeats > availableForChange) {
            throw new NoSeatsAvailableException("Pas assez de places pour ce voyage.");
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
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Le passage à Stripe se fait via l'endpoint checkout-session.");
            }
            if ("PAYPAL".equalsIgnoreCase(pm)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Le paiement PayPal se fait via l'endpoint /api/transport/payments/paypal/create.");
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
        return TransportReservationMapper.toResponse(updated);
    }

    /**
     * Real Stripe Checkout when {@code stripe.api.key} normalizes to {@code sk_test_…} or {@code sk_live_…}
     * (leading/trailing whitespace and UTF-8 BOM are stripped so valid keys are not misclassified).
     */
    public boolean isStripeTransportPaymentsEnabled() {
        return StripeSecretKeys.isStripeSecretConfigured(StripeSecretKeys.normalize(stripeApiKey));
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
            twilioWhatsAppService.sendWhatsApp(
                    full.getUser() != null ? full.getUser().getPhone() : null, msg);
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
            throw new ResourceNotFoundException("Transport invalide.");
        }
        if (Boolean.FALSE.equals(transport.getIsActive())) {
            throw new ResourceNotFoundException("Transport inactif.");
        }
        Integer cap = transport.getCapacity();
        if (cap == null || cap < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Capacité du transport non configurée. Impossible de réserver.");
        }
        int booked = reservationRepository.countBookedSeats(tid);
        if (booked + seatsRequested > cap) {
            throw new NoSeatsAvailableException("Plus de places disponibles pour ce voyage.");
        }
    }

    private static void validateTaxiRouteKm(Transport transport, Double routeKm) {
        if (transport.getType() == Transport.TransportType.TAXI) {
            if (routeKm == null || routeKm <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Le kilométrage estimé est obligatoire pour un taxi.");
            }
        }
    }

    private static LocalDateTime resolveTravelDateTime(String travelDateIso, LocalDateTime fallback) {
        if (travelDateIso == null || travelDateIso.isBlank()) {
            return fallback;
        }
        String t = travelDateIso.trim();
        try {
            if (t.contains("T")) {
                return LocalDateTime.parse(t, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            return LocalDate.parse(t, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de date de voyage invalide.");
        }
    }

    private static void assertReservationOwner(TransportReservation res, int userId) {
        Integer ownerId = res.getUser() != null ? res.getUser().getUserId() : null;
        if (!Objects.equals(ownerId, userId)) {
            throw new AccessDeniedException("Not your reservation");
        }
    }

    private static String safeRef(String reservationRef) {
        if (reservationRef == null || reservationRef.isBlank()) {
            return "";
        }
        return "(" + reservationRef.trim() + ")";
    }
}
