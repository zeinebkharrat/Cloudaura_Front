package org.example.backend.controller;

import org.example.backend.dto.PaymentRequest;
import org.example.backend.service.StripeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@CrossOrigin(origins = "http://localhost:4200") // Pour Angular
public class PaymentController {

    @Autowired
    private StripeService stripeService;

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


}