package org.example.backend.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.model.*;
import org.example.backend.repository.EventReservationItemRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.TicketTypeRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.dto.ApiResponse;
import org.example.backend.service.CatalogTranslationService;
import org.example.backend.service.EventService;
import org.example.backend.service.EmailService;
import org.example.backend.service.QrCodeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.LocalDate;
import java.time.ZoneId;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "http://localhost:4200")
@Slf4j
public class EventController {
    private final EventService eventService;
    private final EventReservationRepository reservationRepository;
    private final EventReservationItemRepository reservationItemRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final UserRepository userRepository;
    private final QrCodeService qrCodeService;
    private final EmailService emailService;
    private final CatalogTranslationService catalogTranslationService;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Value("${stripe.checkout.currency:usd}")
    private String stripeCheckoutCurrency;

    @Value("${stripe.transport.tnd-to-presentment:0.32}")
    private double stripeTndToPresentment;

    @Value("${stripe.api.key:${STRIPE_SECRET_KEY:}}")
    private String stripeApiKey;

    public EventController(
            EventService eventService,
            EventReservationRepository reservationRepository,
            EventReservationItemRepository reservationItemRepository,
            TicketTypeRepository ticketTypeRepository,
            UserRepository userRepository,
            QrCodeService qrCodeService,
            EmailService emailService,
            CatalogTranslationService catalogTranslationService
    ) {
        this.eventService = eventService;
        this.reservationRepository = reservationRepository;
        this.reservationItemRepository = reservationItemRepository;
        this.ticketTypeRepository = ticketTypeRepository;
        this.userRepository = userRepository;
        this.qrCodeService = qrCodeService;
        this.emailService = emailService;
        this.catalogTranslationService = catalogTranslationService;
    }

    private String normalizeFrontendBase() {
        String base = frontendBaseUrl == null ? "http://localhost:4200" : frontendBaseUrl.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }


    // --- GET ---
    @GetMapping
    public ApiResponse<List<Event>> getAllEvents() {
        return ApiResponse.success(eventService.getAllEventsLocalized());
    }

    @GetMapping("/{id}")
    public ApiResponse<Event> getEvent(@PathVariable Integer id) {
        Event event =
                eventService
                        .getEventByIdLocalized(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_not_found"));
        return ApiResponse.success(event);
    }

    @PostMapping
    public ApiResponse<Event> createEvent(@RequestBody Event event) {
        log.debug(
                "createEvent: title={}, cityId={}",
                event.getTitle(),
                event.getCity() != null ? event.getCity().getCityId() : null);
        Event savedEvent = eventService.createOrUpdateEvent(event);
        return ApiResponse.success(savedEvent);
    }

    @PutMapping("/{id}")
    public ApiResponse<Event> updateEvent(@PathVariable Integer id, @RequestBody Event eventDetails) {
        Event updated =
                eventService
                        .getEventById(id)
                        .map(
                                event -> {
                                    event.setTitle(eventDetails.getTitle());
                                    event.setEventType(eventDetails.getEventType());
                                    event.setStartDate(eventDetails.getStartDate());
                                    event.setEndDate(eventDetails.getEndDate());
                                    event.setVenue(eventDetails.getVenue());
                                    event.setStatus(eventDetails.getStatus());
                                    event.setImageUrl(eventDetails.getImageUrl());
                                    event.setPrice(eventDetails.getPrice()); // Mise à jour du prix

                                    // Gestion de la ville pour l'update
                                    if (eventDetails.getCity() != null) {
                                        event.setCity(eventDetails.getCity());
                                    }

                                    return eventService.createOrUpdateEvent(event);
                                })
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_not_found"));
        return ApiResponse.success(updated);
    }

    // --- DELETE ---
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteEvent(@PathVariable Integer id) {
        eventService.deleteEvent(id);
        return ApiResponse.success(null);
    }

    // --- RESERVATION ---
    @PostMapping("/reservations")
    @Transactional
    public ApiResponse<Map<String, Object>> createReservation(
            @RequestBody Map<String, Object> data, Authentication authentication) {
        User currentUser = resolveAuthenticatedUser(authentication);
        Integer currentUserId = currentUser.getUserId();
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.event_invalid_user");
        }

        EventReservation res = new EventReservation();

        Integer eventId = parseInteger(data.get("event_id"));
        Double amount = parseDouble(data.get("total_amount"));
        if (eventId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_id_required");
        }
        Integer requestedTicketTypeId = parseInteger(data.get("ticket_type_id"));
        int quantity = parsePositiveInt(data.get("quantity"), 1);
        if (amount == null) {
            amount = 0d;
        }

        Event event =
                eventService
                        .getEventById(eventId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_not_found"));

        User userRef = new User();
        userRef.setUserId(currentUserId);

        res.setEvent(event);
        res.setUser(userRef);
        res.setTotalAmount(amount);
        res.setStatus(ReservationStatus.CONFIRMED);

        reservationRepository.save(res);

        TicketType ticketType = resolveTicketTypeForCheckout(event, requestedTicketTypeId);
        List<String> qrTokens = new ArrayList<>();
        for (int i = 0; i < quantity; i++) {
            EventReservationItem item = new EventReservationItem();
            item.setEventReservation(res);
            item.setTicketType(ticketType);
            item.setQuantity(1);
            String token = UUID.randomUUID().toString();
            item.setQrCodeToken(token);
            item.setIsScanned(false);
            reservationItemRepository.save(item);
            qrTokens.add(token);
        }

        boolean emailSent = false;
        String emailFailureCode = null;
        try {
            if (currentUser.getEmail() != null && !currentUser.getEmail().isBlank()) {
                String primaryToken =
                        qrTokens.isEmpty() ? String.valueOf(res.getEventReservationId()) : qrTokens.get(0);
                byte[] qrPng = qrCodeService.generateQrPng(primaryToken, 260);
                emailService.sendEventTicketConfirmation(
                        currentUser.getEmail(),
                        currentUser.getFirstName(),
                        event.getTitle(),
                        event.getVenue(),
                        event.getStartDate(),
                        res.getEventReservationId(),
                        qrTokens,
                        qrPng);
                emailSent = true;
            }
        } catch (Exception ex) {
            log.warn("Event ticket confirmation email failed: {}", ex.toString());
            try {
                if (currentUser.getEmail() != null && !currentUser.getEmail().isBlank()) {
                    emailService.sendEventJoinConfirmation(
                            currentUser.getEmail(),
                            currentUser.getFirstName(),
                            event.getTitle(),
                            event.getStartDate(),
                            event.getVenue());
                    emailSent = true;
                }
            } catch (Exception fallbackEx) {
                log.warn("Event join confirmation email failed: {}", fallbackEx.toString());
                emailFailureCode = "api.error.event_email_confirmation_failed";
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("event_reservation_id", res.getEventReservationId());
        body.put("ticketTypeId", ticketType.getTicketTypeId());
        body.put("quantity", quantity);
        body.put("qrCodeTokens", qrTokens);
        body.put("emailSent", emailSent);
        if (emailFailureCode != null) {
            body.put("emailFailureCode", emailFailureCode);
        }
        return ApiResponse.success(body);
    }

    /**
     * Creates a Stripe Checkout session and returns its URL (hosted payment page).
     * Success redirect includes {@code session_id} for {@link #finalizeCheckout}.
     */
    @PostMapping("/create-checkout-session")
    public ApiResponse<Map<String, Object>> createSession(
            @RequestBody Map<String, Object> data, Authentication authentication) {
        try {
            String effectiveStripeKey = resolveStripeApiKey();
            if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "api.error.event_payment_unavailable");
            }

            Stripe.apiKey = effectiveStripeKey;

            Integer eventId = parseInteger(data.get("event_id"));
            if (eventId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_id_required");
            }

            Integer requestedTicketTypeId = parseInteger(data.get("ticket_type_id"));
            int quantity = parsePositiveInt(data.get("quantity"), 1);

            Event e = eventService.getEventById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_not_found"));

            Double dbPrice = e.getPrice() != null ? e.getPrice() : 0d;
            if (dbPrice <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_free_ticket_flow");
            }

            TicketType ticketType = resolveTicketTypeForCheckout(e, requestedTicketTypeId);
            Double ticketPrice = ticketType.getPrice() == null ? dbPrice : ticketType.getPrice();

            EventReservation res = new EventReservation();
            res.setStatus(ReservationStatus.PENDING);
            res.setTotalAmount(ticketPrice * quantity);

            User u = resolveAuthenticatedUser(authentication);
            if (u.getUserId() == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.event_invalid_user");
            }
            User uRef = new User();
            uRef.setUserId(u.getUserId());

            res.setEvent(e);
            res.setUser(uRef);

            reservationRepository.save(res);

            String base = normalizeFrontendBase();
            String currency = stripeCheckoutCurrency == null || stripeCheckoutCurrency.isBlank()
                    ? "usd"
                    : stripeCheckoutCurrency.trim().toLowerCase();
            long unitAmountMinor =
                    "tnd".equals(currency)
                            ? Math.round(ticketPrice * 100.0)
                            : Math.round(ticketPrice * stripeTndToPresentment * 100.0);
            if (unitAmountMinor < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_stripe_amount_too_small");
            }

            Object eventNameObj = data.get("eventName");
            String productName = eventNameObj != null && !eventNameObj.toString().isBlank()
                    ? eventNameObj.toString()
                    : ("Event #" + eventId);

            SessionCreateParams params = SessionCreateParams.builder()
                    .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setClientReferenceId(String.valueOf(res.getEventReservationId()))
                    .putMetadata("reservationId", String.valueOf(res.getEventReservationId()))
                    .putMetadata("eventId", String.valueOf(eventId))
                    .putMetadata("ticketTypeId", String.valueOf(ticketType.getTicketTypeId()))
                    .putMetadata("quantity", String.valueOf(quantity))
                    .setSuccessUrl(base + "/success?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(base + "/evenements")
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity((long) quantity)
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency(currency)
                                    .setUnitAmount(unitAmountMinor)
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName("Event: " + productName)
                                            .build())
                                    .build())
                            .build())
                    .build();

            Session session = Session.create(params);
            String url = session.getUrl();
            if (url == null || url.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY, "api.error.event_stripe_no_checkout_url");
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sessionId", session.getId());
            payload.put("sessionUrl", url);
            return ApiResponse.success(payload);
        } catch (StripeException e) {
            log.error("Stripe event checkout session failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "payment.error.event_checkout_stripe_failed");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unable to create event checkout session", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "api.error.internal");
        }
    }

    /**
     * After Stripe redirects back with {@code session_id}, confirms payment and marks the reservation CONFIRMED.
     */
    @PostMapping("/finalize-checkout")
    @Transactional
    public ApiResponse<Map<String, Object>> finalizeCheckout(
            @RequestBody Map<String, String> body, Authentication authentication) {
        String sessionId = body != null ? body.get("sessionId") : null;
        if (sessionId == null || sessionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_session_id_required");
        }
        String effectiveStripeKey = resolveStripeApiKey();
        if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "api.error.event_payment_unavailable");
        }
        Stripe.apiKey = effectiveStripeKey;
        try {
            Session session = Session.retrieve(sessionId);
            if (!"paid".equalsIgnoreCase(session.getPaymentStatus())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_payment_pending");
            }
            String ref = session.getClientReferenceId();
            if (ref == null || ref.isBlank()) {
                Integer fromMetadata = metadataInt(session, "reservationId");
                if (fromMetadata != null) {
                    ref = String.valueOf(fromMetadata);
                } else {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "api.error.event_session_reservation_ref_missing");
                }
            }
            int reservationId;
            try {
                reservationId = Integer.parseInt(ref.trim());
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "api.error.event_session_reservation_ref_invalid");
            }

            EventReservation res = reservationRepository.findById(reservationId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_reservation_not_found"));

            User current = resolveAuthenticatedUser(authentication);
            if (res.getUser() == null || res.getUser().getUserId() == null
                    || !res.getUser().getUserId().equals(current.getUserId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.ticket.reservation_wrong_user");
            }

            if (ReservationStatus.CONFIRMED.equals(res.getStatus())) {
                Map<String, Object> already = new LinkedHashMap<>();
                already.put("alreadyConfirmed", true);
                already.put("eventReservationId", res.getEventReservationId());
                already.put("eventId", res.getEvent() != null ? res.getEvent().getEventId() : null);
                return ApiResponse.success(already);
            }

            Integer ticketTypeId = metadataInt(session, "ticketTypeId");
            int quantity = parsePositiveInt(metadataInt(session, "quantity"), 1);
            if (ticketTypeId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_ticket_metadata_missing");
            }

            TicketType ticketType = ticketTypeRepository.findById(ticketTypeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_ticket_type_not_found"));

            List<String> qrTokens = new ArrayList<>();
            for (int i = 0; i < quantity; i++) {
                EventReservationItem item = new EventReservationItem();
                item.setEventReservation(res);
                item.setTicketType(ticketType);
                item.setQuantity(1);
                String token = UUID.randomUUID().toString();
                item.setQrCodeToken(token);
                item.setIsScanned(false);
                reservationItemRepository.save(item);
                qrTokens.add(token);
            }

            res.setStatus(ReservationStatus.CONFIRMED);
            reservationRepository.save(res);

            boolean emailSent = false;
            String emailFailureCode = null;
            try {
                if (current.getEmail() != null && !current.getEmail().isBlank()) {
                    String primaryToken =
                            qrTokens.isEmpty() ? String.valueOf(res.getEventReservationId()) : qrTokens.get(0);
                    byte[] qrPng = qrCodeService.generateQrPng(primaryToken, 260);
                    emailService.sendEventTicketConfirmation(
                            current.getEmail(),
                            current.getFirstName(),
                            res.getEvent() != null ? res.getEvent().getTitle() : "Event",
                            res.getEvent() != null ? res.getEvent().getVenue() : "TBA",
                            res.getEvent() != null ? res.getEvent().getStartDate() : null,
                            res.getEventReservationId(),
                            qrTokens,
                            qrPng);
                    emailSent = true;
                }
            } catch (Exception ex) {
                log.warn("Event ticket email after checkout failed: {}", ex.toString());
                emailFailureCode = "api.error.event_email_confirmation_failed";
            }

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("eventReservationId", res.getEventReservationId());
            out.put("eventId", res.getEvent() != null ? res.getEvent().getEventId() : null);
            out.put("ticketTypeId", ticketTypeId);
            out.put("quantity", quantity);
            out.put("qrCodeTokens", qrTokens);
            out.put("emailSent", emailSent);
            if (emailFailureCode != null) {
                out.put("emailFailureCode", emailFailureCode);
            }
            return ApiResponse.success(out);
        } catch (StripeException e) {
            log.error("Stripe finalize event checkout failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "payment.error.event_checkout_stripe_failed");
        }
    }

    @GetMapping("/admin/tickets")
    @Transactional(readOnly = true)
    public ApiResponse<Map<String, Object>> listGeneratedTickets(
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "date", required = false) String date,
            @RequestParam(value = "scanned", required = false) Boolean scanned,
            @RequestParam(value = "lang", defaultValue = "fr") String lang,
            Authentication authentication) {
        requireAdmin(authentication);

        LocalDate dateFilter = parseDate(date);
        String searchLower = search == null ? "" : search.trim().toLowerCase();

        List<Map<String, Object>> rows = reservationItemRepository.findTop1000ByOrderByReservationItemIdDesc()
                .stream()
                .filter(item -> filterBySearch(item, searchLower))
                .filter(item -> filterByDate(item, dateFilter))
                .filter(item -> scanned == null || scanned.equals(Boolean.TRUE.equals(item.getIsScanned())))
                .map(item -> toTicketRow(item, lang))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("count", rows.size());
        response.put("items", rows);
        return ApiResponse.success(response);
    }

    @PostMapping("/admin/tickets/scan")
    @Transactional
    public ApiResponse<Map<String, Object>> scanTicket(
            @RequestBody Map<String, String> body,
            @RequestParam(value = "lang", defaultValue = "fr") String lang,
            Authentication authentication) {
        requireAdmin(authentication);

        String token = body != null ? body.get("token") : null;
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.scan.qr_required");
        }

        String normalizedToken = token.trim();
        EventReservationItem item = reservationItemRepository.findDetailedByQrCodeToken(normalizedToken).orElse(null);
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "api.scan.no_ticket");
        }

        if (Boolean.TRUE.equals(item.getIsScanned())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "api.scan.already_validated");
        }

        int updatedRows = reservationItemRepository.markAsScannedIfNotYet(item.getReservationItemId());
        if (updatedRows == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "api.scan.already_validated");
        }

        EventReservationItem refreshed =
                reservationItemRepository.findDetailedByQrCodeToken(normalizedToken).orElse(item);
        Map<String, Object> ok = new LinkedHashMap<>();
        ok.put("found", true);
        ok.put("alreadyScanned", false);
        ok.put(
                "message",
                catalogTranslationService.resolve("api.scan.validated_ok", lang, "Ticket validated successfully."));
        ok.put("ticket", toTicketRow(refreshed, lang));
        return ApiResponse.success(ok);
    }

    private User resolveAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.unauthorized");
        }
        String identifier = authentication.getName();
        if (identifier == null || identifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.session_invalid");
        }
        return userRepository.findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(identifier, identifier)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.user_not_found"));
    }

    private User requireAdmin(Authentication authentication) {
        User user = resolveAuthenticatedUser(authentication);
        boolean isAdmin = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> r != null && "ROLE_ADMIN".equalsIgnoreCase(r.getName()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.admin_role_required");
        }
        return user;
    }

    private static Integer parseInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Double parseDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static int parsePositiveInt(Object value, int fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            int parsed = Integer.parseInt(String.valueOf(value));
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private TicketType resolveTicketTypeForCheckout(Event event, Integer requestedTicketTypeId) {
        if (requestedTicketTypeId != null) {
            TicketType selected = ticketTypeRepository.findById(requestedTicketTypeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.event_ticket_type_not_found"));
            if (selected.getEvent() == null
                    || selected.getEvent().getEventId() == null
                    || !selected.getEvent().getEventId().equals(event.getEventId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.event_ticket_type_mismatch");
            }
            ensureTicketTypeNameFormat(selected, event);
            return selected;
        }

        TicketType existing = ticketTypeRepository.findFirstByEvent_EventIdOrderByTicketTypeIdAsc(event.getEventId())
                .orElseGet(() -> createDefaultTicketType(event));
        ensureTicketTypeNameFormat(existing, event);
        return existing;
    }

    private TicketType createDefaultTicketType(Event event) {
        TicketType ticket = new TicketType();
        ticket.setEvent(event);
        ticket.setTicketNomevent("ticket_event_titel_id_ticket");
        ticket.setPrice(event.getPrice() == null ? 0d : event.getPrice());
        TicketType saved = ticketTypeRepository.save(ticket);
        ensureTicketTypeNameFormat(saved, event);
        return saved;
    }

    private void ensureTicketTypeNameFormat(TicketType ticketType, Event event) {
        if (ticketType == null || ticketType.getTicketTypeId() == null) {
            return;
        }
        String expected = buildTicketTypeName(event, ticketType.getTicketTypeId());
        String current = ticketType.getTicketNomevent();
        if (!expected.equals(current)) {
            ticketType.setTicketNomevent(expected);
            ticketTypeRepository.save(ticketType);
        }
    }

    private String buildTicketTypeName(Event event, Integer ticketTypeId) {
        String rawTitle = event != null && event.getTitle() != null ? event.getTitle() : "event";
        String normalizedTitle = rawTitle.trim().toLowerCase().replaceAll("[^a-z0-9]+", "_");
        normalizedTitle = normalizedTitle.replaceAll("^_+|_+$", "");
        if (normalizedTitle.isBlank()) {
            normalizedTitle = "event";
        }
        Integer eventId = event != null && event.getEventId() != null ? event.getEventId() : 0;
        return "ticket_event_" + normalizedTitle + "_" + eventId + "_" + ticketTypeId;
    }

    private boolean filterBySearch(EventReservationItem item, String searchLower) {
        if (searchLower == null || searchLower.isBlank()) {
            return true;
        }
        EventReservation reservation = item.getEventReservation();
        User user = reservation != null ? reservation.getUser() : null;
        Event event = reservation != null ? reservation.getEvent() : null;
        TicketType type = item.getTicketType();

        String username = user != null && user.getUsername() != null ? user.getUsername().toLowerCase() : "";
        String eventTitle = event != null && event.getTitle() != null ? event.getTitle().toLowerCase() : "";
        String ticketName = type != null && type.getTicketNomevent() != null ? type.getTicketNomevent().toLowerCase() : "";

        return username.contains(searchLower)
                || eventTitle.contains(searchLower)
                || ticketName.contains(searchLower);
    }

    private boolean filterByDate(EventReservationItem item, LocalDate dateFilter) {
        if (dateFilter == null) {
            return true;
        }
        EventReservation reservation = item.getEventReservation();
        Event event = reservation != null ? reservation.getEvent() : null;
        LocalDate eventDate = toLocalDate(event != null ? event.getStartDate() : null);
        return dateFilter.equals(eventDate);
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private LocalDate toLocalDate(Date date) {
        if (date == null) {
            return null;
        }
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private String computeAttendanceStatus(EventReservationItem item) {
        if (Boolean.TRUE.equals(item.getIsScanned())) {
            return "PRESENT";
        }

        EventReservation reservation = item.getEventReservation();
        Event event = reservation != null ? reservation.getEvent() : null;
        LocalDate eventDate = toLocalDate(event != null ? event.getStartDate() : null);
        if (eventDate != null && eventDate.isBefore(LocalDate.now())) {
            return "ABSENT";
        }
        return "UPCOMING";
    }

    private Map<String, Object> toTicketRow(EventReservationItem item, String lang) {
        EventReservation reservation = item.getEventReservation();
        User user = reservation != null ? reservation.getUser() : null;
        Event event = reservation != null ? reservation.getEvent() : null;
        TicketType type = item.getTicketType();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("reservationItemId", item.getReservationItemId());
        row.put("reservationId", reservation != null ? reservation.getEventReservationId() : null);
        String ticketFallback = type != null ? type.getTicketNomevent() : null;
        String ticketDisplay = type != null && type.getTicketTypeId() != null
                ? catalogTranslationService.resolve("ticket_type." + type.getTicketTypeId(), lang, ticketFallback)
                : ticketFallback;
        row.put("ticketName", ticketDisplay);
        row.put("userName", user != null ? user.getUsername() : null);
        row.put("userEmail", user != null ? user.getEmail() : null);
        String eventTitle = event != null ? event.getTitle() : null;
        String eventDisplay = event != null && event.getEventId() != null
                ? catalogTranslationService.resolve("event." + event.getEventId() + ".title", lang, eventTitle)
                : eventTitle;
        row.put("eventName", eventDisplay);
        LocalDate start = null;
        if (event != null) {
            if (event.getStartDate() != null) {
                start = toLocalDate(event.getStartDate());
            } else if (event.getEndDate() != null) {
                start = toLocalDate(event.getEndDate());
            }
        }
        row.put("startDate", start != null ? start.toString() : null);
        row.put("qrCodeToken", item.getQrCodeToken());
        row.put("isScanned", Boolean.TRUE.equals(item.getIsScanned()));
        row.put("scannedAt", item.getScannedAt());
        row.put("attendanceStatus", computeAttendanceStatus(item));
        return row;
    }

    private static Integer metadataInt(Session session, String key) {
        if (session == null || session.getMetadata() == null) {
            return null;
        }
        String v = session.getMetadata().get(key);
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String resolveStripeApiKey() {
        if (Stripe.apiKey != null && !Stripe.apiKey.isBlank()) {
            return Stripe.apiKey;
        }
        if (stripeApiKey != null && !stripeApiKey.isBlank()) {
            return stripeApiKey;
        }
        String envKey = System.getenv("STRIPE_SECRET_KEY");
        if (envKey != null && !envKey.isBlank()) {
            return envKey;
        }
        return null;
    }
}