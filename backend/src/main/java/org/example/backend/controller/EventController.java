package org.example.backend.controller;

import com.stripe.Stripe;
import com.stripe.model.billingportal.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.model.*;
import org.example.backend.service.EventService;
import org.example.backend.repository.EventReservationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "http://localhost:4200")
public class EventController {

    @Autowired
    private EventService eventService;

    @Autowired
    private EventReservationRepository reservationRepository;


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
            res.setTotalAmount(amount);
            res.setStatus(ReservationStatus.CONFIRMED);

            reservationRepository.save(res);

            return ResponseEntity.ok(Map.of("message", "Réservation liée avec succès !"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Erreur : " + e.getMessage());
        }
    }

    @Value("${STRIPE_SECRET_KEY}")
    private String stripeApiKey;


    @PostMapping("/create-checkout-session")
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

            // CORRECTION ICI : Pas de cast en Map
            Session session = Session.create((Map<String, Object>) params);

            return ResponseEntity.ok(Map.of("sessionId", session.getId()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Erreur Stripe : " + e.getMessage());
        }
    }
}