package org.example.backend.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.example.backend.model.OrderEntity;
import org.example.backend.model.OrderItem;
import org.example.backend.model.OrderStatus;
import org.example.backend.model.Product;
import org.example.backend.dto.transport.TransportPaymentStartDto;
import org.example.backend.model.Reservation;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.OrderEntityRepository;
import org.example.backend.repository.OrderItemRepository;
import org.example.backend.util.StripeSecretKeys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class PaymentService {

    private final OrderEntityRepository orderEntityRepository;
    private final OrderItemRepository orderItemRepository;
    private final EmailService emailService;
    private final CatalogTranslationService catalogTranslationService;
    private final String stripeApiKey;
    private final String frontendBaseUrl;

    @Value("${stripe.publishable.key:}")
    private String stripePublishableKey;

    @Value("${stripe.checkout.currency:usd}")
    private String stripeCheckoutCurrency;

    /** When Checkout currency is not {@code tnd}, line items use {@code amountTnd * this} as presentment amount. */
    @Value("${stripe.transport.tnd-to-presentment:0.32}")
    private double stripeTndToPresentment;

    public PaymentService(
            OrderEntityRepository orderEntityRepository,
            OrderItemRepository orderItemRepository,
            EmailService emailService,
            CatalogTranslationService catalogTranslationService,
            @Value("${stripe.api.key:disabled}") String stripeApiKey,
            @Value("${app.frontend.base-url:http://localhost:4200}") String frontendBaseUrl) {
        this.orderEntityRepository = orderEntityRepository;
        this.orderItemRepository = orderItemRepository;
        this.emailService = emailService;
        this.catalogTranslationService = catalogTranslationService;
        this.stripeApiKey = stripeApiKey;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    @PostConstruct
    void configureStripeApiKey() {
        String key = StripeSecretKeys.normalize(stripeApiKey);
        if (StripeSecretKeys.isStripeSecretConfigured(key)) {
            Stripe.apiKey = key;
            log.info("Stripe.apiKey initialized for PaymentService (transport/shop Checkout enabled)");
        } else {
            Stripe.apiKey = null;
            log.info("Stripe.apiKey not set — stripe.api.key is blank, disabled, or not sk_test_/sk_live_ after normalize");
        }
    }

    private String normalizedStripeCurrency() {
        if (stripeCheckoutCurrency == null || stripeCheckoutCurrency.isBlank()) {
            return "usd";
        }
        return stripeCheckoutCurrency.trim().toLowerCase();
    }

    /** Business DB amounts are TND; Stripe minor units use the configured Checkout currency. */
    private long minorUnitsFromTnd(double amountTnd) {
        if ("tnd".equals(normalizedStripeCurrency())) {
            return Math.round(amountTnd * 100.0);
        }
        double presentment = amountTnd * stripeTndToPresentment;
        return Math.round(presentment * 100.0);
    }

    private String resolveProductLineDisplayName(Product product) {
        if (product == null) {
            return "";
        }
        String fallback = product.getName() != null ? product.getName() : "";
        Integer id = product.getProductId();
        if (id == null) {
            return fallback;
        }
        return catalogTranslationService.resolveEntityField(id, "product", "name", fallback);
    }

    private String stripeLineItemNameWithTndRef(String base, double totalTnd) {
        if ("tnd".equals(normalizedStripeCurrency())) {
            return base;
        }
        String suffixPattern =
                catalogTranslationService.resolveForRequest(
                        "reservation.payment.stripe_tnd_ref_suffix", " (réf. %.2f TND)");
        return base + String.format(Locale.US, suffixPattern, totalTnd);
    }

    public String generatePaymentUrl(OrderEntity order) {
        if (!StripeSecretKeys.isStripeSecretConfigured(StripeSecretKeys.normalize(stripeApiKey))) {
            // Simulated local payment gateway (Konnect/Stripe mock)
            return frontendBaseUrl + "/mock-payment?orderId=" + order.getOrderId() + "&amount=" + order.getTotalAmount();
        }

        String checkoutCurrency = normalizedStripeCurrency();
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
                            .setCurrency(checkoutCurrency)
                            .setUnitAmount(minorUnitsFromTnd(price))
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(resolveProductLineDisplayName(oi.getProduct()))
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
                            .setCurrency(checkoutCurrency)
                            .setUnitAmount(minorUnitsFromTnd(order.getDeliveryFee()))
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(
                                            catalogTranslationService.resolveForRequest(
                                                    "payment.line.delivery",
                                                    "Frais de livraison"))
                                    .build()
                            )
                            .build()
                    )
                    .build()
            );
        }

        // Calculate missing discount to match order.getTotalAmount() precisely (since promo applies globally)
        long expectedTotalCents = minorUnitsFromTnd(order.getTotalAmount());
        long currentTotalCents = stripeLines.stream().mapToLong(l -> l.getPriceData().getUnitAmount() * l.getQuantity()).sum();

        if (currentTotalCents > expectedTotalCents) {
           // We have a discount
           long discount = currentTotalCents - expectedTotalCents;
           stripeLines.add(
                SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(checkoutCurrency)
                            // Negative amounts not strictly supported in LineItems, so we might need a Coupon or adjust base prices.
                            // But for simplicity in this MVP, we create an artificial discount line if possible, or just build one generic line.
                            // To avoid Stripe errors with negative units, we will combine into one total line if discount exists
                            .setUnitAmount(-discount) 
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(
                                            catalogTranslationService.resolveForRequest(
                                                    "payment.line.promo_discount",
                                                    "Réduction (code promo)"))
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
                String orderLineFmt =
                        catalogTranslationService.resolveForRequest(
                                "payment.line.order_total", "Commande n°%s");
                stripeLines.add(
                    SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(checkoutCurrency)
                                .setUnitAmount(expectedTotalCents)
                                .setProductData(
                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                .setName(String.format(orderLineFmt, order.getOrderId()))
                                                .build())
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
            log.error("Stripe checkout session (shop) failed", e);
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "reservation.payment.stripe_generic_error");
        }
    }

    /**
     * Stripe Checkout for a transport reservation. Stored totals are TND; Checkout uses {@code stripe.checkout.currency}
     * and {@code stripe.transport.tnd-to-presentment} when the presentment currency is not TND.
     */
    public TransportPaymentStartDto createTransportCheckoutSession(TransportReservation reservation, double totalTnd) {
        String key = StripeSecretKeys.normalize(stripeApiKey);
        if (!StripeSecretKeys.isStripeSecretConfigured(key)) {
            log.warn("createTransportCheckoutSession called but stripe secret not configured after normalize");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "reservation.payment.stripe_not_configured");
        }
        Stripe.apiKey = key;

        String checkoutCurrency = normalizedStripeCurrency();
        long unitAmount = totalTnd <= 0 ? 0L : minorUnitsFromTnd(totalTnd);
        assertTransportStripeChargeable(unitAmount, checkoutCurrency);

        String ref = reservation.getReservationRef();
        String transportPrefix =
                catalogTranslationService.resolveForRequest(
                        "reservation.payment.transport_prefix", "Transport");
        String label =
                transportPrefix
                        + " — "
                        + (ref != null && !ref.isBlank() ? ref : "#" + reservation.getTransportReservationId());

        List<SessionCreateParams.LineItem> stripeLines = List.of(
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                        .setCurrency(checkoutCurrency)
                                        .setUnitAmount(unitAmount)
                                        .setProductData(
                                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                        .setName(stripeLineItemNameWithTndRef(label, totalTnd))
                                                        .build())
                                        .build())
                        .build());

        String returnUrl = frontendBaseUrl + "/transport/payment/return?session_id={CHECKOUT_SESSION_ID}";

        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(returnUrl)
                    .setCancelUrl(frontendBaseUrl + "/transport")
                    .putMetadata(
                            "transportReservationId",
                            String.valueOf(reservation.getTransportReservationId()))
                    .addAllLineItem(stripeLines)
                    .build();

            Session session = Session.create(params);
            String url = session.getUrl();
            log.info(
                    "Stripe transport Checkout session created: sessionId={} transportReservationId={} urlPresent={}",
                    session.getId(),
                    reservation.getTransportReservationId(),
                    url != null && !url.isBlank());
            if (url == null || url.isBlank()) {
                log.error("Stripe returned no checkout URL for transport reservation {}", reservation.getTransportReservationId());
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY, "reservation.payment.stripe_no_checkout_url");
            }
            return TransportPaymentStartDto.builder().url(url).build();
        } catch (StripeException e) {
            log.error(
                    "Stripe transport checkout failed (currency={}, unitAmount={}, reservationId={})",
                    checkoutCurrency,
                    unitAmount,
                    reservation.getTransportReservationId(),
                    e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.payment.stripe_unavailable");
        }
    }

    /**
     * Stripe Checkout for an accommodation stay (TND). Metadata {@code accommodationReservationId} is used on return.
     */
    public TransportPaymentStartDto createAccommodationCheckoutSession(Reservation reservation, double totalTnd) {
        if (reservation == null || reservation.getReservationId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "reservation.payment.invalid_accommodation_reservation");
        }
        String key = StripeSecretKeys.normalize(stripeApiKey);
        if (!StripeSecretKeys.isStripeSecretConfigured(key)) {
            log.warn("createAccommodationCheckoutSession called but stripe secret not configured after normalize");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "reservation.payment.stripe_not_configured_accommodation");
        }
        Stripe.apiKey = key;

        String checkoutCurrency = normalizedStripeCurrency();
        long unitAmount = minorUnitsFromTnd(totalTnd);
        assertTransportStripeChargeable(unitAmount, checkoutCurrency);

        String hebPrefix =
                catalogTranslationService.resolveForRequest(
                        "reservation.payment.accommodation_prefix", "Hébergement");
        String resWord =
                catalogTranslationService.resolveForRequest(
                        "reservation.payment.reservation_word", "réservation");
        String label = hebPrefix + " — " + resWord + " #" + reservation.getReservationId();

        List<SessionCreateParams.LineItem> stripeLines = List.of(
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(
                                SessionCreateParams.LineItem.PriceData.builder()
                                        .setCurrency(checkoutCurrency)
                                        .setUnitAmount(unitAmount)
                                        .setProductData(
                                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                        .setName(stripeLineItemNameWithTndRef(label, totalTnd))
                                                        .build())
                                        .build())
                        .build());

        String returnUrl = frontendBaseUrl + "/hebergement/payment/return?session_id={CHECKOUT_SESSION_ID}";

        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(returnUrl)
                    .setCancelUrl(frontendBaseUrl + "/hebergement")
                    .putMetadata(
                            "accommodationReservationId",
                            String.valueOf(reservation.getReservationId()))
                    .addAllLineItem(stripeLines)
                    .build();

            log.info(
                    "Creating Stripe Checkout Session for accommodation reservationId={}",
                    reservation.getReservationId());
            Session session = Session.create(params);

            String url = session.getUrl();
            if (url == null || url.isBlank()) {
                log.error(
                        "Stripe returned no checkout URL for accommodation reservation {}",
                        reservation.getReservationId());
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY, "reservation.payment.stripe_no_checkout_url");
            }
            return TransportPaymentStartDto.builder().url(url).build();
        } catch (StripeException e) {
            log.error(
                    "Stripe accommodation checkout failed (currency={}, unitAmount={}, reservationId={})",
                    checkoutCurrency,
                    unitAmount,
                    reservation.getReservationId(),
                    e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.payment.stripe_unavailable");
        }
    }

    /** Enforces Stripe-style minimums for common two-decimal presentment currencies. */
    private void assertTransportStripeChargeable(long minorAmount, String currency) {
        if (minorAmount <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reservation.payment.amount_invalid_stripe");
        }
        String c = currency == null ? "" : currency.trim().toLowerCase();
        // Stripe minimum ~0.50 for USD/EUR/AUD/CAD/CHF/GBP/SGD/NZD (minor units = cents)
        if (("usd".equals(c)
                        || "eur".equals(c)
                        || "gbp".equals(c)
                        || "cad".equals(c)
                        || "aud".equals(c)
                        || "chf".equals(c)
                        || "sgd".equals(c)
                        || "nzd".equals(c))
                && minorAmount < 50) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "reservation.payment.amount_too_low_stripe");
        }
    }

    @Transactional
    public void markOrderAsPaid(Integer orderId) {
        OrderEntity order = orderEntityRepository
            .findById(orderId)
            .orElseThrow(
                    () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "payment.error.order_not_found"));
        
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

            if (order.getUser() != null && order.getUser().getEmail() != null && !order.getUser().getEmail().isBlank()) {
                try {
                    emailService.sendOrderConfirmation(
                            order.getUser().getEmail(),
                            String.valueOf(order.getOrderId()),
                            order.getTotalAmount());
                } catch (Exception ex) {
                    log.warn("Order paid but confirmation email failed for orderId={}: {}", orderId, ex.getMessage());
                }
            }
        }
    }
}
