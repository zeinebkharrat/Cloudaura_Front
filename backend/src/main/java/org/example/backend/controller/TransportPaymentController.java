package org.example.backend.controller;

import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.transport.TransportCheckoutRequest;
import org.example.backend.dto.transport.TransportPaymentStartDto;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.service.PaymentService;
import org.example.backend.service.TransportReservationService;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Transport Stripe checkout: POST creates a session; client redirects with {@code window.location.href}
 * to Stripe-hosted Checkout (same idea as {@code EventController#createCheckoutSession}).
 */
@RestController
@RequestMapping("/api/transport/payments")
@RequiredArgsConstructor
@Slf4j
public class TransportPaymentController {

    private final TransportReservationService transportReservationService;
    private final PaymentService paymentService;
    private final UserIdentityResolver userIdentityResolver;

    @PostMapping("/checkout-session")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, String>> createCheckoutSession(
            @Valid @RequestBody TransportCheckoutRequest body, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("api.error.unauthorized");
        }

        boolean realStripe = paymentService.isStripeCheckoutEnabled();
        log.info(
                "Transport checkout-session: realStripe={} (stripe.api.key normalized prefix: {})",
                realStripe,
            paymentService.stripeKeyPrefixForLogs());

        var handoff = transportReservationService.prepareTransportStripeCheckoutHandoff(body, uid);

        final String url;
        if (realStripe) {
            if (handoff.localSimulationUrl() != null) {
                log.error(
                        "Stripe secret key is configured (sk_test_/sk_live_) but handoff returned a local URL — refusing.");
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Stripe est activé : une URL locale ne doit pas être renvoyée.");
            }
            if (handoff.reservation() == null) {
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR, "Réservation manquante pour Stripe Checkout.");
            }
            TransportPaymentStartDto start =
                    paymentService.createTransportCheckoutSession(
                            handoff.reservation(), handoff.totalTnd(), body.getPresentmentCurrency());
            url = start.getUrl();
            log.info("Stripe session URL: {}", url);
        } else {
            url = handoff.localSimulationUrl();
            log.info("Transport checkout branch: local_simulation urlLen={}", url != null ? url.length() : 0);
        }

        if (url == null || url.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "api.error.transport_payment.checkout_url_missing");
        }
        return ApiResponse.success(Map.of("url", url));
    }

    @GetMapping("/confirm-session")
    public ApiResponse<TransportReservationResponse> confirmSession(
            @RequestParam("session_id") String sessionId, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("api.error.unauthorized");
        }
        if (sessionId == null || sessionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.transport_payment.session_required");
        }
        return ApiResponse.success(transportReservationService.confirmTransportStripeSession(sessionId.trim(), uid));
    }
}
