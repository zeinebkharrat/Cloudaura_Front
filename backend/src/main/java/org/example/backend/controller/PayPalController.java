package org.example.backend.controller;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.transport.TransportPayPalCreateRequest;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.model.TransportReservation;
import org.example.backend.service.IPaypalService;
import org.example.backend.service.PayPalService;
import org.example.backend.service.TransportReservationService;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import jakarta.annotation.PostConstruct;

@RestController
@RequestMapping("/api/transport/payments/paypal")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class PayPalController {

    private final IPaypalService paypalService;
    private final TransportReservationService transportReservationService;
    private final UserIdentityResolver userIdentityResolver;

    @Value("${paypal.client.id:}")
    private String paypalClientId;

    @Value("${paypal.client.secret:}")
    private String paypalClientSecret;

    @Value("${paypal.return.url:http://localhost:4200/transport/payment/return}")
    private String paypalReturnUrl;

    @Value("${paypal.cancel.url:http://localhost:4200/transport/payment/cancel}")
    private String paypalCancelUrl;

    @PostConstruct
    void logPayPalConfig() {
        boolean ok = isPayPalConfigured();
        String prefix =
                paypalClientId == null || paypalClientId.length() < 8
                        ? "(vide)"
                        : paypalClientId.substring(0, 8) + "…";
        log.info("PayPal configuration: enabled={} clientIdPrefix={}", ok, prefix);
    }

    @PostMapping("/create")
    public ApiResponse<Map<String, Object>> create(
            @Valid @RequestBody TransportPayPalCreateRequest body, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (!isPayPalConfigured()) {
            log.warn("PayPal create rejected: client id/secret missing or blank");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "PayPal n'est pas configuré. Ajoutez paypal.client.id et paypal.client.secret dans "
                            + "application-local.properties (profil local), ou les variables PAYPAL_CLIENT_ID et "
                            + "PAYPAL_CLIENT_SECRET, puis redémarrez le backend.");
        }

        log.info(
                "PayPal transport create: userId={} transportId={} seats={} amountTnd={}",
                uid,
                body.getTransportId(),
                body.getSeats(),
                body.getAmountTnd());

        TransportReservation reservation = transportReservationService.createPendingPayPalReservation(uid, body);

        String amountUsd = PayPalService.formatUsdFromTnd(body.getAmountTnd());
        String returnBase = normalizeUrl(paypalReturnUrl);
        String sep = returnBase.contains("?") ? "&" : "?";
        String returnUrl = returnBase + sep + "method=paypal&reservationId=" + reservation.getTransportReservationId();
        String cancelUrl = normalizeUrl(paypalCancelUrl);

        Map<String, Object> orderResponse = paypalService.createOrder(amountUsd, returnUrl, cancelUrl);
        String approvalUrl = PayPalService.extractApprovalUrl(orderResponse);
        if (approvalUrl == null || approvalUrl.isBlank()) {
            log.error("PayPal order missing approve link for reservationId={}", reservation.getTransportReservationId());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "PayPal n'a pas renvoyé de lien d'approbation.");
        }

        log.info(
                "PayPal approval URL ready for reservationId={} orderId={}",
                reservation.getTransportReservationId(),
                orderResponse.get("id"));

        Map<String, Object> payload = new HashMap<>();
        payload.put("url", approvalUrl);
        payload.put("reservationId", reservation.getTransportReservationId());
        return ApiResponse.success(payload);
    }

    @GetMapping("/capture")
    public ResponseEntity<?> capture(
            @RequestParam("token") String token,
            @RequestParam("reservationId") int reservationId,
            Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "token (PayPal order id) requis.");
        }
        if (!isPayPalConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "PayPal n'est pas configuré. Définissez les clés Sandbox (voir message du POST create).");
        }

        log.info("PayPal capture request: userId={} reservationId={} tokenLen={}", uid, reservationId, token.length());

        try {
            TransportReservationResponse dto =
                    transportReservationService.confirmTransportPayPalCapture(token.trim(), reservationId, uid);
            Map<String, Object> data = new HashMap<>();
            data.put("status", "CONFIRMED");
            data.put("reservationId", reservationId);
            data.put("reservation", dto);
            return ResponseEntity.ok(ApiResponse.success(data));
        } catch (ResponseStatusException e) {
            if (e.getStatusCode() == HttpStatus.BAD_REQUEST
                    && e.getReason() != null
                    && "FAILED".equalsIgnoreCase(e.getReason())) {
                log.warn("PayPal capture failed reservationId={}", reservationId);
                return ResponseEntity.badRequest().body(Map.of("status", "FAILED"));
            }
            throw e;
        }
    }

    private boolean isPayPalConfigured() {
        String cid = paypalClientId == null ? "" : paypalClientId.trim();
        String sec = paypalClientSecret == null ? "" : paypalClientSecret.trim();
        if (cid.isEmpty() || sec.isEmpty()) {
            return false;
        }
        return true;
    }

    private static String normalizeUrl(String u) {
        if (u == null || u.isBlank()) {
            return "http://localhost:4200";
        }
        return u.trim();
    }
}
