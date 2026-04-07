package org.example.backend.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.model.*;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.service.EventService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "http://localhost:4200")
public class EventController {
    private final EventService eventService;
    private final EventReservationRepository reservationRepository;
    private final UserRepository userRepository;

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
            UserRepository userRepository
    ) {
        this.eventService = eventService;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
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

    @GetMapping("/{id}")
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

    @PutMapping("/{id}")
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

    // --- DELETE ---
    @DeleteMapping("/{id}")
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

            return ResponseEntity.ok(Map.of(
                    "message", "Reservation linked successfully.",
                    "event_reservation_id", res.getEventReservationId()
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
                        .body("Stripe is not configured. Set stripe.api.key (application.properties) or STRIPE_SECRET_KEY.");
            }

            Stripe.apiKey = effectiveStripeKey;

            Integer eventId = parseInteger(data.get("event_id"));
            if (eventId == null) {
                return ResponseEntity.badRequest().body("event_id is required");
            }
            Event e = eventService.getEventById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

            Double dbPrice = e.getPrice() != null ? e.getPrice() : 0d;
            if (dbPrice <= 0) {
                return ResponseEntity.badRequest().body("This event has no paid ticket. Use the free reservation flow.");
            }

            EventReservation res = new EventReservation();
            res.setStatus(ReservationStatus.PENDING);
            res.setTotalAmount(dbPrice);

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
                            ? Math.round(dbPrice * 100.0)
                            : Math.round(dbPrice * stripeTndToPresentment * 100.0);
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
                    .setSuccessUrl(base + "/success?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(base + "/evenements")
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
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
            return ResponseEntity.status(500).body("Stripe error: " + e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
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
            return ResponseEntity.status(500).body("Stripe is not configured");
        }
        Stripe.apiKey = effectiveStripeKey;
        try {
            Session session = Session.retrieve(sessionId);
            if (!"paid".equalsIgnoreCase(session.getPaymentStatus())) {
                return ResponseEntity.badRequest().body("Payment not completed yet");
            }
            String ref = session.getClientReferenceId();
            if (ref == null || ref.isBlank()) {
                return ResponseEntity.badRequest().body("Missing reservation reference on session");
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

            res.setStatus(ReservationStatus.CONFIRMED);
            reservationRepository.save(res);

            return ResponseEntity.ok(Map.of(
                    "message", "Reservation confirmed",
                    "eventReservationId", res.getEventReservationId(),
                    "eventId", res.getEvent() != null ? res.getEvent().getEventId() : null
            ));
        } catch (StripeException e) {
            return ResponseEntity.status(500).body("Stripe error: " + e.getMessage());
        }
    }

    private User resolveAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        String identifier = authentication.getName();
        if (identifier == null || identifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide");
        }
        return userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
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