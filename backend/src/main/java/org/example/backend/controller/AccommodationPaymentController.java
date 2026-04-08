package org.example.backend.controller;

import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.accommodation.AccommodationReservationRequest;
import org.example.backend.dto.accommodation.AccommodationReservationResponse;
import org.example.backend.service.AccommodationReservationService;
import org.example.backend.service.PaymentService;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.beans.factory.annotation.Value;
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

@RestController
@RequestMapping("/api/accommodation/payments")
@RequiredArgsConstructor
@Slf4j
public class AccommodationPaymentController {

    private final AccommodationReservationService accommodationReservationService;
    private final PaymentService paymentService;
    private final UserIdentityResolver userIdentityResolver;

    @Value("${stripe.api.key:disabled}")
    private String stripeApiKey;

    @PostMapping("/checkout-session")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, String>> createCheckoutSession(
            @Valid @RequestBody AccommodationReservationRequest body, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("Authentication required");
        }

        log.info("Accommodation Stripe key present: {}", stripeApiKey != null && !stripeApiKey.isBlank());

        var handoff = accommodationReservationService.prepareAccommodationStripeCheckout(body, uid);
        final String url;
        if (handoff.localSimulationUrl() != null) {
            url = handoff.localSimulationUrl();
            log.info("Accommodation checkout branch: local_simulation");
        } else {
            url = paymentService
                    .createAccommodationCheckoutSession(handoff.reservation(), handoff.totalTnd())
                    .getUrl();
            log.info("Accommodation checkout branch: stripe_checkout_session");
        }
        if (url == null || url.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No checkout URL");
        }
        return ApiResponse.success(Map.of("url", url));
    }

    @GetMapping("/confirm-session")
    public ApiResponse<AccommodationReservationResponse> confirmSession(
            @RequestParam("session_id") String sessionId, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (sessionId == null || sessionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "session_id requis.");
        }
        return ApiResponse.success(
                accommodationReservationService.confirmAccommodationStripeSession(sessionId.trim(), uid));
    }
}
