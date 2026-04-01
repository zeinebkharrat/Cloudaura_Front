package org.example.backend.controller;

import org.example.backend.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/mock-confirm/{orderId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> mockConfirmPayment(@PathVariable Integer orderId) {
        paymentService.markOrderAsPaid(orderId);
        return ResponseEntity.ok().build();
    }
}
