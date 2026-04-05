package org.example.backend.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.publicapi.ActivityCheckoutSessionResponse;
import org.example.backend.dto.publicapi.ActivityReservationResponse;
import org.example.backend.dto.publicapi.CreateActivityReservationRequest;
import org.example.backend.dto.publicapi.FinalizeCheckoutRequest;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.ActivityReservation;
import org.example.backend.model.ReservationStatus;
import org.example.backend.model.User;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.service.ActivityReceiptLinkService;
import org.example.backend.service.ActivityReceiptPdfService;
import org.example.backend.service.ActivityReservationService;
import org.example.backend.service.QrCodeService;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class ActivityPaymentController {

    private final ActivityReservationService reservationService;
    private final ActivityMediaRepository activityMediaRepository;
    private final ActivityReservationRepository reservationRepository;
    private final ActivityReceiptLinkService activityReceiptLinkService;
    private final ActivityReceiptPdfService activityReceiptPdfService;
    private final QrCodeService qrCodeService;
    private final UserIdentityResolver userIdentityResolver;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Value("${stripe.checkout.currency:usd}")
    private String stripeCheckoutCurrency;

    @Value("${stripe.api.key:${STRIPE_SECRET_KEY:}}")
    private String stripeApiKey;

    @PostMapping("/activities/{activityId}/reservations/checkout")
    @Transactional
    public ResponseEntity<?> createCheckoutSession(
        @PathVariable Integer activityId,
        @Valid @RequestBody CreateActivityReservationRequest request
    ) {
        try {
            String effectiveStripeKey = resolveStripeApiKey();
            if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Stripe is not configured. Set stripe.api.key or STRIPE_SECRET_KEY.");
            }

            Stripe.apiKey = effectiveStripeKey;

            ActivityReservation reservation = reservationService.createPendingReservation(activityId, request);
            Activity activity = reservation.getActivity();
            if (activity == null || activity.getActivityId() == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Invalid activity reservation state");
            }

            double totalPrice = reservation.getTotalPrice() != null ? reservation.getTotalPrice() : 0.0;
            long unitAmountMinor = Math.round(totalPrice * 100);
            if (unitAmountMinor < 1) {
                return ResponseEntity.badRequest().body("Total amount must be greater than 0 for Stripe payment.");
            }

            String base = normalizeFrontendBase();
            String currency = stripeCheckoutCurrency == null || stripeCheckoutCurrency.isBlank()
                ? "usd"
                : stripeCheckoutCurrency.trim().toLowerCase();

            String activityName = activity.getName() != null && !activity.getName().isBlank()
                ? activity.getName().trim()
                : ("Activity #" + activity.getActivityId());

            SessionCreateParams params = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setClientReferenceId(String.valueOf(reservation.getActivityReservationId()))
                .setSuccessUrl(base + "/activities/payment-success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(base + "/activities/" + activity.getActivityId())
                .addLineItem(SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                        .setCurrency(currency)
                        .setUnitAmount(unitAmountMinor)
                        .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                            .setName("Activity booking: " + activityName)
                            .build())
                        .build())
                    .build())
                .build();

            Session session = Session.create(params);
            String url = session.getUrl();
            if (url == null || url.isBlank()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Stripe did not return a checkout URL");
            }

            return ResponseEntity.ok(new ActivityCheckoutSessionResponse(session.getId(), url));
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (StripeException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Stripe error: " + ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error: " + ex.getMessage());
        }
    }

    @PostMapping("/activity-reservations/finalize-checkout")
    @Transactional
    public ResponseEntity<?> finalizeCheckout(
        @Valid @RequestBody FinalizeCheckoutRequest request,
        Authentication authentication
    ) {
        String effectiveStripeKey = resolveStripeApiKey();
        if (effectiveStripeKey == null || effectiveStripeKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("Stripe is not configured");
        }

        Stripe.apiKey = effectiveStripeKey;

        try {
            Session session = Session.retrieve(request.getSessionId());
            if (!"paid".equalsIgnoreCase(session.getPaymentStatus())) {
                return ResponseEntity.badRequest().body("Payment not completed yet");
            }

            String ref = session.getClientReferenceId();
            if (ref == null || ref.isBlank()) {
                return ResponseEntity.badRequest().body("Missing reservation reference on session");
            }

            int reservationId;
            try {
                reservationId = Integer.parseInt(ref.trim());
            } catch (NumberFormatException ex) {
                return ResponseEntity.badRequest().body("Invalid reservation reference");
            }

            ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Activity reservation not found"));

            assertReservationOwner(reservation, authentication);

            if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
                reservation.setStatus(ReservationStatus.CONFIRMED);
                reservationRepository.save(reservation);
            }

            ActivityReservationResponse response = reservationService.toResponse(reservation);
            return ResponseEntity.ok(response);
        } catch (StripeException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Stripe error: " + ex.getMessage());
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(ex.getReason());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Could not finalize checkout: " + ex.getMessage());
        }
    }

    @GetMapping("/activity-reservations/{reservationId}/qr")
    public ResponseEntity<byte[]> getReservationQr(
        @PathVariable Integer reservationId,
        Authentication authentication
    ) {
        ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("Activity reservation not found"));

        assertReservationOwner(reservation, authentication);
        assertConfirmedReservation(reservation);

        String content = activityReceiptPdfService.buildQrContent(reservation);
        byte[] qr = qrCodeService.generateQrPng(content, 320);

        return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_PNG)
            .header(HttpHeaders.CACHE_CONTROL, "max-age=86400")
            .body(qr);
    }

    @GetMapping("/activity-reservations/{reservationId}/pdf")
    public ResponseEntity<byte[]> getReservationPdf(
        @PathVariable Integer reservationId,
        Authentication authentication
    ) {
        ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("Activity reservation not found"));

        assertReservationOwner(reservation, authentication);
        assertConfirmedReservation(reservation);

        byte[] pdf = activityReceiptPdfService.generateReceiptPdf(reservation);
        String filename = "activity-receipt-ACT-" + reservation.getActivityReservationId() + ".pdf";

        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .body(pdf);
    }

    @GetMapping("/activity-receipts/{reservationId}/pdf")
    public ResponseEntity<byte[]> viewReservationPdfByQr(
        @PathVariable Integer reservationId,
        @RequestParam(name = "sig", required = false) String signature
    ) {
        if (!activityReceiptLinkService.isValidSignature(reservationId, signature)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid receipt link signature");
        }

        ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("Activity reservation not found"));

        assertConfirmedReservation(reservation);

        byte[] pdf = activityReceiptPdfService.generateReceiptPdf(reservation);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"yallatn-activity-confirmation.pdf\"")
            .body(pdf);
    }

        @GetMapping(value = "/activity-receipts/{reservationId}", produces = MediaType.TEXT_HTML_VALUE)
        public ResponseEntity<String> viewReceiptLandingByQr(
                @PathVariable Integer reservationId,
                @RequestParam(name = "sig", required = false) String signature
        ) {
                if (!activityReceiptLinkService.isValidSignature(reservationId, signature)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid receipt link signature");
                }

                ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
                        .orElseThrow(() -> new ResourceNotFoundException("Activity reservation not found"));
                assertConfirmedReservation(reservation);

                String activityName = reservation.getActivity() != null ? reservation.getActivity().getName() : "Activity";
                String cityName = reservation.getActivity() != null && reservation.getActivity().getCity() != null
                        ? reservation.getActivity().getCity().getName()
                        : "Tunisia";

                String imageUrl = reservation.getActivity() == null
                        ? null
                        : activityMediaRepository.findByActivityActivityIdOrderByMediaIdDesc(reservation.getActivity().getActivityId())
                                .stream()
                                .map(ActivityMedia::getUrl)
                                .filter(url -> url != null && !url.isBlank())
                                .findFirst()
                                .orElse(null);

                String downloadUrl = "/api/public/activity-receipts/" + reservationId + "/pdf?sig=" + signature;
                String imageBlock = (imageUrl != null)
                        ? "<img class=\"hero\" src=\"" + esc(imageUrl) + "\" alt=\"Activity image\"/>"
                        : "<div class=\"hero-fallback\">" + esc(activityName) + "</div>";

                String html = """
                        <!doctype html>
                        <html lang="en">
                        <head>
                            <meta charset="utf-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                            <title>YallaTN Receipt</title>
                            <style>
                                body { margin:0; font-family: Arial, sans-serif; background:#eef3f8; color:#1b2a3a; }
                                .wrap { max-width: 680px; margin: 0 auto; padding: 20px 14px; }
                                .card { background:#fff; border-radius: 16px; overflow:hidden; border:1px solid #d6e2ee; }
                                .head { background:#103a56; color:#fff; padding:14px 16px; }
                                .head h1 { margin:0; font-size:20px; }
                                .sub { margin-top:6px; opacity:.9; font-size:13px; }
                                .hero { width:100%%; height:220px; display:block; }
                                .hero-fallback { height:220px; background:#1b4965; color:#fff; font-weight:700; text-align:center; line-height:220px; }
                                .body { padding:16px; }
                                .meta { margin:0 0 14px; font-size:14px; }
                                .meta strong { color:#0f2f45; }
                                .btn { display:inline-block; background:#f12545; color:#fff; text-decoration:none; padding:12px 16px; border-radius:10px; font-weight:700; }
                            </style>
                        </head>
                        <body>
                            <div class="wrap">
                                <div class="card">
                                    <div class="head">
                                        <h1>YallaTN+ Payment Receipt</h1>
                                        <div class="sub">Scan successful. Download your PDF confirmation.</div>
                                    </div>
                                    %s
                                    <div class="body">
                                        <p class="meta"><strong>Activity:</strong> %s<br/><strong>City:</strong> %s</p>
                                        <a class="btn" href="%s">Download PDF</a>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                        """.formatted(imageBlock, esc(activityName), esc(cityName), esc(downloadUrl));

                return ResponseEntity.ok()
                        .contentType(MediaType.TEXT_HTML)
                        .body(html);
        }

    private void assertReservationOwner(ActivityReservation reservation, Authentication authentication) {
        Integer currentUserId = userIdentityResolver.resolveUserId(authentication);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        User owner = reservation.getUser();
        if (owner == null || owner.getUserId() == null || !owner.getUserId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This reservation belongs to another account");
        }
    }

    private void assertConfirmedReservation(ActivityReservation reservation) {
        if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Receipt is available only for confirmed reservations");
        }
    }

    private String normalizeFrontendBase() {
        String base = frontendBaseUrl == null ? "http://localhost:4200" : frontendBaseUrl.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private String resolveStripeApiKey() {
        if (isUsableStripeKey(Stripe.apiKey)) {
            return Stripe.apiKey;
        }
        if (isUsableStripeKey(stripeApiKey)) {
            return stripeApiKey;
        }
        String envKey = System.getenv("STRIPE_SECRET_KEY");
        if (isUsableStripeKey(envKey)) {
            return envKey;
        }
        return null;
    }

    private boolean isUsableStripeKey(String value) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim();
        if (normalized.isBlank()) {
            return false;
        }
        return !"disabled".equalsIgnoreCase(normalized)
            && !"changeme".equalsIgnoreCase(normalized)
            && !"change-me".equalsIgnoreCase(normalized);
    }

    private String esc(String value) {
        if (value == null) {
            return "";
        }
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
}
