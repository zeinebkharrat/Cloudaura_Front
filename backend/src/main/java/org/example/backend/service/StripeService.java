package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.dto.PaymentRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
@Service
public class StripeService {

    @Value("${stripe.api.key}")
    private String stripeSecretKey;

    public String createCheckoutSession(PaymentRequest request) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        String name = (request.getProductName() != null && !request.getProductName().isEmpty())
                ? request.getProductName()
                : "Ticket Evénement #" + request.getEventId();

        SessionCreateParams params = SessionCreateParams.builder()
                // 1. AJOUTER LE MODE (Indispensable)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                // 2. AJOUTER LES URLS DE RETOUR (Indispensable)
                // Remplace localhost:4200 par ton URL de prod plus tard
                .setSuccessUrl("http://localhost:4200/success")
                .setCancelUrl("http://localhost:4200/cancel")
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity(1L)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency("eur")
                                                .setUnitAmount(request.getAmount())
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName(name)
                                                                .build())
                                                .build())
                                .build())
                .build();

        Session session = Session.create(params);
        return session.getUrl();
    }
}