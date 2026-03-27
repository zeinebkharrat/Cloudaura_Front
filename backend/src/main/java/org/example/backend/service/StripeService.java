package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.dto.PaymentRequest;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
@Service
public class StripeService {

    @PostConstruct
    public void init() {
        Stripe.apiKey = "pk_test_51TFAEsBCrgk7EbwDBJOgFQ4XLe147tO3l5BlTw4pDOUO4XPT7v5fZucKgyyQuqczW9Bcxd9v3qeY9HImpIFiCvMz007Bg1Okcw";
    }

    public String createCheckoutSession(PaymentRequest paymentRequest) throws Exception {
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