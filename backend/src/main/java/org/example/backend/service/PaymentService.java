package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import java.util.ArrayList;
import java.util.List;
import org.example.backend.model.OrderEntity;
import org.example.backend.model.OrderItem;
import org.example.backend.model.OrderStatus;
import org.example.backend.repository.OrderEntityRepository;
import org.example.backend.repository.OrderItemRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentService {

    private final OrderEntityRepository orderEntityRepository;
    private final OrderItemRepository orderItemRepository;
    private final String stripeApiKey;
    private final String frontendBaseUrl;

    public PaymentService(
            OrderEntityRepository orderEntityRepository,
            OrderItemRepository orderItemRepository,
            @Value("${stripe.api.key}") String stripeApiKey,
            @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.orderEntityRepository = orderEntityRepository;
        this.orderItemRepository = orderItemRepository;
        this.stripeApiKey = stripeApiKey;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public String generatePaymentUrl(OrderEntity order) {
        if (stripeApiKey == null || stripeApiKey.isBlank() || stripeApiKey.equals("disabled")) {
            // Simulated local payment gateway (Konnect/Stripe mock)
            return frontendBaseUrl + "/mock-payment?orderId=" + order.getOrderId() + "&amount=" + order.getTotalAmount();
        }

        Stripe.apiKey = stripeApiKey;

        List<SessionCreateParams.LineItem> stripeLines = new ArrayList<>();
        List<OrderItem> items = orderItemRepository.findByOrderIdWithProduct(order.getOrderId());
        
        for (OrderItem oi : items) {
            double price = oi.getVariant() != null && oi.getVariant().getPriceOverride() != null 
                            ? oi.getVariant().getPriceOverride() 
                            : oi.getProduct().getPrice();

            stripeLines.add(
                SessionCreateParams.LineItem.builder()
                    .setQuantity((long) oi.getQuantity())
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency("tnd")
                            .setUnitAmount((long) (price * 100))
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(oi.getProduct().getName())
                                    .build()
                            )
                            .build()
                    )
                    .build()
            );
        }

        // Add Delivery Fee Line
        if (order.getDeliveryFee() != null && order.getDeliveryFee() > 0) {
             stripeLines.add(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency("tnd")
                            .setUnitAmount((long) (order.getDeliveryFee() * 100))
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Frais de Livraison")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            );
        }

        // Calculate missing discount to match order.getTotalAmount() precisely (since promo applies globally)
        long expectedTotalCents = (long) (order.getTotalAmount() * 100);
        long currentTotalCents = stripeLines.stream().mapToLong(l -> l.getPriceData().getUnitAmount() * l.getQuantity()).sum();

        if (currentTotalCents > expectedTotalCents) {
           // We have a discount
           long discount = currentTotalCents - expectedTotalCents;
           stripeLines.add(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency("tnd")
                            // Negative amounts not strictly supported in LineItems, so we might need a Coupon or adjust base prices.
                            // But for simplicity in this MVP, we create an artificial discount line if possible, or just build one generic line.
                            // To avoid Stripe errors with negative units, we will combine into one total line if discount exists
                            .setUnitAmount(-discount) 
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName("Code Promo (Réduction)")
                                    .build()
                            )
                            .build()
                    )
                    .build()
            );
        }

        try {
            // Safe fallback if the discount logic causes Stripe rejection: create a single line item
            if (currentTotalCents != expectedTotalCents) {
                stripeLines.clear();
                stripeLines.add(
                    SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                            SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("tnd")
                                .setUnitAmount(expectedTotalCents)
                                .setProductData(
                                    SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Commande #" + order.getOrderId())
                                        .build()
                                )
                                .build()
                        )
                        .build()
                );
            }

            SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendBaseUrl + "/mes-commandes?success=true")
                .setCancelUrl(frontendBaseUrl + "/mes-commandes?canceled=true")
                .putMetadata("orderId", String.valueOf(order.getOrderId()))
                .addAllLineItem(stripeLines)
                .build();

            Session session = Session.create(params);
            return session.getUrl();
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur génération Stripe");
        }
    }

    @Transactional
    public void markOrderAsPaid(Integer orderId) {
        OrderEntity order = orderEntityRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
        
        if (order.getStatus() == OrderStatus.PENDING) {
            order.setStatus(OrderStatus.PROCESSING); // Indicates payment success, artisan should prepare it
            orderEntityRepository.save(order);
            
            // Optionally, update order items to PROCESSING too
            List<OrderItem> items = orderItemRepository.findByOrderIdWithProduct(orderId);
            for (OrderItem item : items) {
                if (item.getStatus() == OrderStatus.PENDING) {
                    item.setStatus(OrderStatus.PROCESSING);
                    orderItemRepository.save(item);
                }
            }
        }
    }
}
