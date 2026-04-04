package org.example.backend.controller;

import java.util.HashMap;
import java.util.Map;
import org.example.backend.dto.PaymentRequest;
import org.example.backend.service.PaymentService;
import org.example.backend.service.StripeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payment")
@CrossOrigin(origins = "http://localhost:4200")
public class PaymentController {

    private final StripeService stripeService;
    private final PaymentService paymentService;

    public PaymentController(StripeService stripeService, PaymentService paymentService) {
        this.stripeService = stripeService;
        this.paymentService = paymentService;
    }

    @PostMapping("/create-session")
    public Map<String, String> createSession(@RequestBody PaymentRequest request) {
        try {
            String sessionId = stripeService.createCheckoutSession(request);
            Map<String, String> response = new HashMap<>();
            response.put("id", sessionId);
            return response;
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @PostMapping("/mock-confirm/{orderId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> mockConfirmPayment(@PathVariable Integer orderId) {
        paymentService.markOrderAsPaid(orderId);
        return ResponseEntity.ok().build();
    }
}
