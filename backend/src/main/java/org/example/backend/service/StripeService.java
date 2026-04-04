package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.dto.PaymentRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
@Service
public class StripeService {

        @Value("${stripe.api.key:}")
        private String stripeApiKey;

    @PostConstruct
    public void init() {
                if (stripeApiKey != null && !stripeApiKey.isBlank()) {
                        Stripe.apiKey = stripeApiKey;
                }
    }

    public String createCheckoutSession(PaymentRequest paymentRequest) throws Exception {
                if (stripeApiKey == null || stripeApiKey.isBlank()) {
                        throw new IllegalStateException("Stripe is not configured. Set stripe.api.key or STRIPE_SECRET_KEY.");
                }

        SessionCreateParams params = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl("http://localhost:4200/success")
                .setCancelUrl("http://localhost:4200/cancel")
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("eur")
                                .setUnitAmount(paymentRequest.getAmount())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(paymentRequest.getEventName())
                                        .build())
                                .build())
                        .build())
                .build();

        Session session = Session.create(params);
        return session.getId();
    }
}