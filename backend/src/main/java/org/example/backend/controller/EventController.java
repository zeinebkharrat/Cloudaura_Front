package org.example.backend.controller;

import com.stripe.Stripe;
<<<<<<< HEAD
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
=======
import com.stripe.model.billingportal.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.model.*;
import org.example.backend.service.EventService;
import org.example.backend.repository.EventReservationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "http://localhost:4200")
public class EventController {
<<<<<<< HEAD
    private final EventService eventService;
    private final EventReservationRepository reservationRepository;
    private final UserRepository userRepository;

    public EventController(
            EventService eventService,
            EventReservationRepository reservationRepository,
            UserRepository userRepository
    ) {
        this.eventService = eventService;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
    }
=======

    @Autowired
    private EventService eventService;

    @Autowired
    private EventReservationRepository reservationRepository;
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236


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
<<<<<<< HEAD
    @Transactional
    public ResponseEntity<?> createReservation(@RequestBody Map<String, Object> data, Authentication authentication) {
        try {
            User currentUser = resolveAuthenticatedUser(authentication);
            Integer currentUserId = currentUser.getUserId();
            if (currentUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Utilisateur non valide");
            }

            EventReservation res = new EventReservation();

            Integer eventId = parseInteger(data.get("event_id"));
            Double amount = parseDouble(data.get("total_amount"));
            if (eventId == null) {
                return ResponseEntity.badRequest().body("event_id est requis");
            }
            if (amount == null) {
                amount = 0d;
            }

            Event event = eventService.getEventById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event introuvable"));

                User userRef = new User();
                userRef.setUserId(currentUserId);

            res.setEvent(event);
                res.setUser(userRef);
=======
    public ResponseEntity<?> createReservation(@RequestBody Map<String, Object> data) {
        try {
            EventReservation res = new EventReservation();

            Integer eventId = (Integer) data.get("event_id");
            Integer userId = (Integer) data.get("user_id");
            Double amount = Double.valueOf(data.get("total_amount").toString());

            Event event = new Event(); event.setId(eventId);
            User user = new User(); user.setId(userId);

            res.setEvent(event);
            res.setUser(user);
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
            res.setTotalAmount(amount);
            res.setStatus(ReservationStatus.CONFIRMED);

            reservationRepository.save(res);

<<<<<<< HEAD
            return ResponseEntity.ok(Map.of(
                    "message", "Réservation liée avec succès !",
                    "event_reservation_id", res.getEventReservationId()
            ));
=======
            return ResponseEntity.ok(Map.of("message", "Réservation liée avec succès !"));
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Erreur : " + e.getMessage());
        }
    }

<<<<<<< HEAD
    @Value("${stripe.api.key:${STRIPE_SECRET_KEY:}}")
=======
    @Value("${STRIPE_SECRET_KEY}")
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
    private String stripeApiKey;


    @PostMapping("/create-checkout-session")
<<<<<<< HEAD
    @Transactional
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> data, Authentication authentication) {
        try {
            String effectiveStripeKey = resolveStripeApiKey();
            if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
                return ResponseEntity.status(500)
                        .body("Stripe is not configured. Set stripe.api.key (application.properties) or STRIPE_SECRET_KEY.");
            }

            Stripe.apiKey = effectiveStripeKey;

            EventReservation res = new EventReservation();
            res.setStatus(ReservationStatus.PENDING);
            Double amount = parseDouble(data.get("amount"));
            if (amount == null || amount <= 0) {
                return ResponseEntity.badRequest().body("amount doit être > 0");
            }
            res.setTotalAmount(amount);

            Integer eventId = parseInteger(data.get("event_id"));
            if (eventId == null) {
                return ResponseEntity.badRequest().body("event_id est requis");
            }
            Event e = eventService.getEventById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event introuvable"));

            User u = resolveAuthenticatedUser(authentication);
            if (u.getUserId() == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Utilisateur non valide");
            }
            User uRef = new User();
            uRef.setUserId(u.getUserId());

            res.setEvent(e);
            res.setUser(uRef);
=======
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> data) {
        try {
            // Utilise ta clé test
            Stripe.apiKey = stripeApiKey;

            EventReservation res = new EventReservation();
            res.setStatus(ReservationStatus.PENDING);
            res.setTotalAmount(Double.parseDouble(data.get("amount").toString()));

            // Attention : utilise setEventId car c'est le nom dans ton entité Event
            Event e = new Event();
            e.setEventId((Integer) data.get("event_id"));

            User u = new User();
            u.setId(1); // À dynamiser plus tard

            res.setEvent(e);
            res.setUser(u);
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236

            reservationRepository.save(res);

            // Construction des paramètres de la session
            SessionCreateParams params = SessionCreateParams.builder()
                    .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    // On passe l'ID de réservation pour le récupérer sur la page success d'Angular
                    .setSuccessUrl("http://localhost:4200/success?resId=" + res.getEventReservationId())
                    .setCancelUrl("http://localhost:4200/events")
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency("usd") // ou "eur"
                                    .setUnitAmount((long)(res.getTotalAmount() * 100)) // Stripe calcule en centimes
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName("Event: " + data.get("eventName")).build())
                                    .build())
                            .build())
                    .build();

<<<<<<< HEAD
            Session session = Session.create(params);

            return ResponseEntity.ok(Map.of(
                    "sessionId", session.getId(),
                    "sessionUrl", session.getUrl()
            ));
=======
            // CORRECTION ICI : Pas de cast en Map
            Session session = Session.create((Map<String, Object>) params);

            return ResponseEntity.ok(Map.of("sessionId", session.getId()));
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Erreur Stripe : " + e.getMessage());
        }
    }
<<<<<<< HEAD

    private User resolveAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication requise");
        }
        String identifier = authentication.getName();
        if (identifier == null || identifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide");
        }
        return userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
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
=======
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
}