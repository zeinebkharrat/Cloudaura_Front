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
import org.example.backend.service.EventService;
import org.example.backend.service.EventPosterAiService;
import org.example.backend.service.HuggingFacePosterService;
import org.example.backend.service.ImgBbService;
import org.example.backend.service.EmailService;
import org.example.backend.service.QrCodeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

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
public class EventController {
    private final EventService eventService;
    private final EventReservationRepository reservationRepository;
    private final EventReservationItemRepository reservationItemRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final UserRepository userRepository;
    private final QrCodeService qrCodeService;
    private final EmailService emailService;
    private final EventPosterAiService eventPosterAiService;
    private final HuggingFacePosterService huggingFacePosterService;
    private final ImgBbService imgBbService;

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
            EventPosterAiService eventPosterAiService,
            HuggingFacePosterService huggingFacePosterService,
            ImgBbService imgBbService
    ) {
        this.eventService = eventService;
        this.reservationRepository = reservationRepository;
        this.reservationItemRepository = reservationItemRepository;
        this.ticketTypeRepository = ticketTypeRepository;
        this.userRepository = userRepository;
        this.qrCodeService = qrCodeService;
        this.emailService = emailService;
        this.eventPosterAiService = eventPosterAiService;
        this.huggingFacePosterService = huggingFacePosterService;
        this.imgBbService = imgBbService;
    }

    private String normalizeFrontendBase() {
        String base = frontendBaseUrl == null ? "http://localhost:4200" : frontendBaseUrl.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }


    // --- GET ---
    @GetMapping
    public List<Event> getAllEvents() {
        return eventService.getAllEvents();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<Event> getEvent(@PathVariable Integer id) {
        return eventService.getEventById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createEvent(@RequestBody Event event) {
        try {
            System.out.println("Received Event: " + event.getTitle() + " for City ID: " +
                    (event.getCity() != null ? event.getCity().getCityId() : "null"));

            Event savedEvent = eventService.createOrUpdateEvent(event);
            return ResponseEntity.ok(savedEvent);
        } catch (Exception e) {
            // Cela te permettra de voir l'erreur réelle dans les logs de ton IDE (IntelliJ/Eclipse)
            e.printStackTrace();
            return ResponseEntity.status(500).body("Backend Error: " + e.getMessage());
        }
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<Event> updateEvent(@PathVariable Integer id, @RequestBody Event eventDetails) {
        return eventService.getEventById(id).map(event -> {
            event.setTitle(eventDetails.getTitle());
            event.setEventType(eventDetails.getEventType());
            event.setStartDate(eventDetails.getStartDate());
            event.setEndDate(eventDetails.getEndDate());
            event.setVenue(eventDetails.getVenue());
            event.setStatus(eventDetails.getStatus());
            event.setImageUrl(eventDetails.getImageUrl());
            event.setPrice(eventDetails.getPrice()); // Mise à jour du prix

            // Gestion de la ville pour l'update
            if(eventDetails.getCity() != null) {
                event.setCity(eventDetails.getCity());
            }

            return ResponseEntity.ok(eventService.createOrUpdateEvent(event));
        }).orElse(ResponseEntity.notFound().build());
    }

        @PostMapping(
            value = {"/extract-from-image", "/extract-from-image/", "/admin/extract-from-image", "/admin/extract-from-image/"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
        )
    public ResponseEntity<?> extractFromImage(
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        requireAdmin(authentication);
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Image file is required", "text", ""));
        }

        try {
            String text = eventPosterAiService.extractText(file);
            return ResponseEntity.ok(Map.of("text", text == null ? "" : text));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", ex.getMessage(), "text", ""));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage(), "text", ""));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", "AI extraction failed", "text", ""));
        }
    }

    @PostMapping({"/admin/generate-poster", "/admin/generate-poster/", "/generate-poster", "/generate-poster/"})
    public ResponseEntity<?> generatePoster(
            @RequestBody Map<String, Object> payload,
            Authentication authentication
    ) {
        requireAdmin(authentication);

        String title = String.valueOf(payload.getOrDefault("title", "")).trim();
        String city = String.valueOf(payload.getOrDefault("city", "")).trim();
        String category = String.valueOf(payload.getOrDefault("category", "")).trim();
        String description = String.valueOf(payload.getOrDefault("description", "")).trim();

        if (title.isBlank() || city.isBlank() || category.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "title, city and category are required"
            ));
        }

        try {
            String prompt = buildPosterPrompt(title, city, category, description);
            byte[] posterBytes = huggingFacePosterService.generatePoster(prompt);
            String uploadedUrl = imgBbService.uploadImageBytes(posterBytes, slugify(title) + "-poster.png");

            return ResponseEntity.ok(Map.of(
                    "prompt", prompt,
                    "imageUrl", uploadedUrl
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", ex.getMessage()));
        } catch (Exception ex) {
            String details = ex.getMessage();
            if (details == null || details.isBlank()) {
                Throwable cause = ex.getCause();
                if (cause != null && cause.getMessage() != null && !cause.getMessage().isBlank()) {
                    details = cause.getMessage();
                }
            }
            if (details == null || details.isBlank()) {
                details = "Unexpected error while generating poster";
            }
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("message", "Poster generation failed: " + details));
        }
    }

    // --- DELETE ---
    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Integer id) {
        eventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    // --- RESERVATION ---
    @PostMapping("/reservations")
    @Transactional
    public ResponseEntity<?> createReservation(@RequestBody Map<String, Object> data, Authentication authentication) {
        try {
            User currentUser = resolveAuthenticatedUser(authentication);
            Integer currentUserId = currentUser.getUserId();
            if (currentUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid user");
            }

            EventReservation res = new EventReservation();

            Integer eventId = parseInteger(data.get("event_id"));
            Double amount = parseDouble(data.get("total_amount"));
            if (eventId == null) {
                return ResponseEntity.badRequest().body("event_id is required");
            }
            Integer requestedTicketTypeId = parseInteger(data.get("ticket_type_id"));
            int quantity = parsePositiveInt(data.get("quantity"), 1);
            if (amount == null) {
                amount = 0d;
            }

            Event event = eventService.getEventById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

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
            String emailError = "";
            try {
                if (currentUser.getEmail() != null && !currentUser.getEmail().isBlank()) {
                    String primaryToken = qrTokens.isEmpty()
                            ? String.valueOf(res.getEventReservationId())
                            : qrTokens.get(0);
                    byte[] qrPng = qrCodeService.generateQrPng(primaryToken, 260);
                    emailService.sendEventTicketConfirmation(
                            currentUser.getEmail(),
                            currentUser.getFirstName(),
                            event.getTitle(),
                            event.getVenue(),
                            event.getStartDate(),
                            res.getEventReservationId(),
                            qrTokens,
                            qrPng
                    );
                    emailSent = true;
                }
            } catch (Exception ex) {
                try {
                    if (currentUser.getEmail() != null && !currentUser.getEmail().isBlank()) {
                        emailService.sendEventJoinConfirmation(
                                currentUser.getEmail(),
                                currentUser.getFirstName(),
                                event.getTitle(),
                                event.getStartDate(),
                                event.getVenue()
                        );
                        emailSent = true;
                    }
                } catch (Exception fallbackEx) {
                    emailError = fallbackEx.getMessage() == null
                            ? "Email provider error"
                            : fallbackEx.getMessage();
                }
            }

                    if (!emailSent) {
                    return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                        "message", "Registration created, but confirmation email failed.",
                        "emailSent", false,
                        "emailError", emailError.isBlank() ? "Email provider error" : emailError
                    ));
                    }

            return ResponseEntity.ok(Map.of(
                    "message", "Reservation linked successfully.",
                    "event_reservation_id", res.getEventReservationId(),
                    "ticketTypeId", ticketType.getTicketTypeId(),
                    "quantity", quantity,
                    "qrCodeTokens", qrTokens,
                    "emailSent", emailSent,
                    "emailError", emailError
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Erreur : " + e.getMessage());
        }
    }

    /**
     * Creates a Stripe Checkout session and returns its URL (hosted payment page).
     * Success redirect includes {@code session_id} for {@link #finalizeCheckout}.
     */
    @PostMapping("/create-checkout-session")
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> data, Authentication authentication) {
        try {
            String effectiveStripeKey = resolveStripeApiKey();
            if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
                return ResponseEntity.status(500)
                        .body("Online payment is temporarily unavailable.");
            }

            Stripe.apiKey = effectiveStripeKey;

            Integer eventId = parseInteger(data.get("event_id"));
            if (eventId == null) {
                return ResponseEntity.badRequest().body("event_id is required");
            }

            Integer requestedTicketTypeId = parseInteger(data.get("ticket_type_id"));
            int quantity = parsePositiveInt(data.get("quantity"), 1);

            Event e = eventService.getEventById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

            Double dbPrice = e.getPrice() != null ? e.getPrice() : 0d;
            if (dbPrice <= 0) {
                return ResponseEntity.badRequest().body("This event has no paid ticket. Use the free reservation flow.");
            }

            TicketType ticketType = resolveTicketTypeForCheckout(e, requestedTicketTypeId);
            Double ticketPrice = ticketType.getPrice() == null ? dbPrice : ticketType.getPrice();

            EventReservation res = new EventReservation();
            res.setStatus(ReservationStatus.PENDING);
            res.setTotalAmount(ticketPrice * quantity);

            User u = resolveAuthenticatedUser(authentication);
            if (u.getUserId() == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid user");
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
                return ResponseEntity.badRequest().body("amount too small for Stripe");
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
                return ResponseEntity.status(500).body("Stripe did not return a checkout URL");
            }

            return ResponseEntity.ok(Map.of(
                    "sessionId", session.getId(),
                    "sessionUrl", url
            ));
        } catch (StripeException e) {
            return ResponseEntity.status(500).body("Online payment is temporarily unavailable.");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Unable to create checkout session right now.");
        }
    }

    /**
     * After Stripe redirects back with {@code session_id}, confirms payment and marks the reservation CONFIRMED.
     */
    @PostMapping("/finalize-checkout")
    @Transactional
    public ResponseEntity<?> finalizeCheckout(@RequestBody Map<String, String> body, Authentication authentication) {
        String sessionId = body != null ? body.get("sessionId") : null;
        if (sessionId == null || sessionId.isBlank()) {
            return ResponseEntity.badRequest().body("sessionId is required");
        }
        String effectiveStripeKey = resolveStripeApiKey();
        if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
            return ResponseEntity.status(500).body("Online payment is temporarily unavailable.");
        }
        Stripe.apiKey = effectiveStripeKey;
        try {
            Session session = Session.retrieve(sessionId);
            if (!"paid".equalsIgnoreCase(session.getPaymentStatus())) {
                return ResponseEntity.badRequest().body("Payment not completed yet");
            }
            String ref = session.getClientReferenceId();
            if (ref == null || ref.isBlank()) {
                Integer fromMetadata = metadataInt(session, "reservationId");
                if (fromMetadata != null) {
                    ref = String.valueOf(fromMetadata);
                } else {
                    return ResponseEntity.badRequest().body("Missing reservation reference on session");
                }
            }
            int reservationId;
            try {
                reservationId = Integer.parseInt(ref.trim());
            } catch (NumberFormatException ex) {
                return ResponseEntity.badRequest().body("Invalid reservation reference");
            }

            EventReservation res = reservationRepository.findById(reservationId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

            User current = resolveAuthenticatedUser(authentication);
            if (res.getUser() == null || res.getUser().getUserId() == null
                    || !res.getUser().getUserId().equals(current.getUserId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("This reservation belongs to another account");
            }

            if (ReservationStatus.CONFIRMED.equals(res.getStatus())) {
                return ResponseEntity.ok(Map.of(
                        "message", "Reservation already confirmed",
                        "eventReservationId", res.getEventReservationId(),
                        "eventId", res.getEvent() != null ? res.getEvent().getEventId() : null
                ));
            }

            Integer ticketTypeId = metadataInt(session, "ticketTypeId");
            int quantity = parsePositiveInt(metadataInt(session, "quantity"), 1);
            if (ticketTypeId == null) {
                return ResponseEntity.badRequest().body("Ticket type metadata is missing");
            }

            TicketType ticketType = ticketTypeRepository.findById(ticketTypeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket type not found"));

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
            String emailError = "";
            try {
                if (current.getEmail() != null && !current.getEmail().isBlank()) {
                    String primaryToken = qrTokens.isEmpty() ? String.valueOf(res.getEventReservationId()) : qrTokens.get(0);
                    byte[] qrPng = qrCodeService.generateQrPng(primaryToken, 260);
                    emailService.sendEventTicketConfirmation(
                            current.getEmail(),
                            current.getFirstName(),
                            res.getEvent() != null ? res.getEvent().getTitle() : "Event",
                            res.getEvent() != null ? res.getEvent().getVenue() : "TBA",
                            res.getEvent() != null ? res.getEvent().getStartDate() : null,
                            res.getEventReservationId(),
                            qrTokens,
                            qrPng
                    );
                            emailSent = true;
                }
                        } catch (Exception ex) {
                // Non-blocking: payment confirmation stays successful even if email sending fails.
                        emailError = ex.getMessage() == null ? "Email provider error" : ex.getMessage();
            }

            return ResponseEntity.ok(Map.of(
                    "message", "Reservation confirmed",
                    "eventReservationId", res.getEventReservationId(),
                    "eventId", res.getEvent() != null ? res.getEvent().getEventId() : null,
                    "ticketTypeId", ticketTypeId,
                    "quantity", quantity,
                            "qrCodeTokens", qrTokens,
                            "emailSent", emailSent,
                            "emailError", emailError
            ));
        } catch (StripeException e) {
            return ResponseEntity.status(500).body("Online payment is temporarily unavailable.");
        }
    }

                    @GetMapping("/admin/tickets")
                    @Transactional(readOnly = true)
                    public ResponseEntity<?> listGeneratedTickets(
                        @RequestParam(value = "search", required = false) String search,
                        @RequestParam(value = "date", required = false) String date,
                        @RequestParam(value = "scanned", required = false) Boolean scanned,
                        Authentication authentication
                    ) {
                    requireAdmin(authentication);

                    LocalDate dateFilter = parseDate(date);
                    String searchLower = search == null ? "" : search.trim().toLowerCase();

                    List<Map<String, Object>> rows = reservationItemRepository.findTop1000ByOrderByReservationItemIdDesc()
                        .stream()
                        .filter(item -> filterBySearch(item, searchLower))
                        .filter(item -> filterByDate(item, dateFilter))
                        .filter(item -> scanned == null || scanned.equals(Boolean.TRUE.equals(item.getIsScanned())))
                        .map(this::toTicketRow)
                        .toList();

                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("count", rows.size());
                    response.put("items", rows);
                    return ResponseEntity.ok(response);
                    }

                    @PostMapping("/admin/tickets/scan")
                    @Transactional
                    public ResponseEntity<?> scanTicket(@RequestBody Map<String, String> body, Authentication authentication) {
                    requireAdmin(authentication);

                    String token = body != null ? body.get("token") : null;
                    if (token == null || token.isBlank()) {
                        return ResponseEntity.badRequest().body(Map.of(
                            "found", false,
                            "message", "QR token is required."
                        ));
                    }

                    String normalizedToken = token.trim();
                    EventReservationItem item = reservationItemRepository.findDetailedByQrCodeToken(normalizedToken)
                        .orElse(null);
                    if (item == null) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                            "found", false,
                            "message", "No ticket found for this QR code."
                        ));
                    }

                    if (Boolean.TRUE.equals(item.getIsScanned())) {
                        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                            "found", true,
                            "alreadyScanned", true,
                            "message", "This ticket was already validated.",
                            "ticket", toTicketRow(item)
                        ));
                    }

                    int updatedRows = reservationItemRepository.markAsScannedIfNotYet(item.getReservationItemId());
                    if (updatedRows == 0) {
                        EventReservationItem refreshed = reservationItemRepository.findDetailedByQrCodeToken(normalizedToken)
                            .orElse(item);
                        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                            "found", true,
                            "alreadyScanned", true,
                            "message", "This ticket was already validated.",
                            "ticket", toTicketRow(refreshed)
                        ));
                    }

                    EventReservationItem refreshed = reservationItemRepository.findDetailedByQrCodeToken(normalizedToken)
                        .orElse(item);
                    return ResponseEntity.ok(Map.of(
                        "found", true,
                        "alreadyScanned", false,
                        "message", "Ticket validated successfully.",
                        "ticket", toTicketRow(refreshed)
                    ));
                    }

    private User resolveAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        String identifier = authentication.getName();
        if (identifier == null || identifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide");
        }
        return userRepository.findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(identifier, identifier)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private User requireAdmin(Authentication authentication) {
        User user = resolveAuthenticatedUser(authentication);
        boolean isAdmin = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> r != null && "ROLE_ADMIN".equalsIgnoreCase(r.getName()));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
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

    private String buildPosterPrompt(String title, String city, String category, String description) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Create a cinematic event background image for Tunisia travel content. ")
                .append("Event type: ").append(category).append(". ")
                .append("Event name: ").append(title).append(". ")
                .append("Location: ").append(city).append(", Tunisia. ")
            .append("Dynamic composition, high resolution, modern style, clean space for UI overlay text. ")
            .append("No typography, no words, no letters, no numbers, no watermark, no signature, no logo.");

        if (!description.isBlank() && !"null".equalsIgnoreCase(description)) {
            prompt.append(" Additional details: ").append(description).append('.');
        }
        return prompt.toString();
    }

    private String slugify(String value) {
        String normalized = value == null ? "event" : value.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        normalized = normalized.replaceAll("^-+|-+$", "");
        return normalized.isBlank() ? "event" : normalized;
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
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket type not found"));
            if (selected.getEvent() == null
                    || selected.getEvent().getEventId() == null
                    || !selected.getEvent().getEventId().equals(event.getEventId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket type does not belong to this event");
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

    private Map<String, Object> toTicketRow(EventReservationItem item) {
        EventReservation reservation = item.getEventReservation();
        User user = reservation != null ? reservation.getUser() : null;
        Event event = reservation != null ? reservation.getEvent() : null;
        TicketType type = item.getTicketType();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("reservationItemId", item.getReservationItemId());
        row.put("reservationId", reservation != null ? reservation.getEventReservationId() : null);
        row.put("ticketName", type != null ? type.getTicketNomevent() : null);
        row.put("userName", user != null ? user.getUsername() : null);
        row.put("userEmail", user != null ? user.getEmail() : null);
        row.put("eventName", event != null ? event.getTitle() : null);
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