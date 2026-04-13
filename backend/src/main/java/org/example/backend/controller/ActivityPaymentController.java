package org.example.backend.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import org.example.backend.service.ReservationTranslationHelper;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
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
@Slf4j
public class ActivityPaymentController {

    private final ActivityReservationService reservationService;
    private final ActivityMediaRepository activityMediaRepository;
    private final ActivityReservationRepository reservationRepository;
    private final ActivityReceiptLinkService activityReceiptLinkService;
    private final ActivityReceiptPdfService activityReceiptPdfService;
    private final QrCodeService qrCodeService;
    private final UserIdentityResolver userIdentityResolver;
    private final ReservationTranslationHelper reservationLabels;

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
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "reservation.payment.stripe_not_configured");
            }

            Stripe.apiKey = effectiveStripeKey;

            ActivityReservation reservation = reservationService.createPendingReservation(activityId, request);
            Activity activity = reservation.getActivity();
            if (activity == null || activity.getActivityId() == null) {
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR, "reservation.error.activity_reservation_state");
            }

            double totalPrice = reservation.getTotalPrice() != null ? reservation.getTotalPrice() : 0.0;
            long unitAmountMinor = Math.round(totalPrice * 100);
            if (unitAmountMinor < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.payment.amount_positive");
            }

            String base = normalizeFrontendBase();
            String currency = stripeCheckoutCurrency == null || stripeCheckoutCurrency.isBlank()
                ? "usd"
                : stripeCheckoutCurrency.trim().toLowerCase();

            int actId = activity.getActivityId();
            String activityNameRaw = activity.getName() != null && !activity.getName().isBlank()
                ? activity.getName().trim()
                : "";
            String activityName = reservationLabels.activityName(actId, activityNameRaw);

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
                            .setName(String.format(
                                reservationLabels.tr(
                                    "reservation.payment.activity_booking_line",
                                    "Réservation d’activité : %s"),
                                activityName))
                            .build())
                        .build())
                    .build())
                .build();

            Session session = Session.create(params);
            String url = session.getUrl();
            if (url == null || url.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR, "reservation.payment.stripe_no_checkout_url");
            }

            return ResponseEntity.ok(new ActivityCheckoutSessionResponse(session.getId(), url));
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (StripeException ex) {
            log.warn("Stripe checkout session failed", ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.payment.stripe_generic_error");
        } catch (Exception ex) {
            log.warn("Activity checkout session failed", ex);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "reservation.payment.checkout_error");
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
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "reservation.payment.stripe_not_configured");
        }

        Stripe.apiKey = effectiveStripeKey;

        try {
            Session session = Session.retrieve(request.getSessionId());
            if (!"paid".equalsIgnoreCase(session.getPaymentStatus())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.payment.not_completed");
            }

            String ref = session.getClientReferenceId();
            if (ref == null || ref.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "reservation.payment.missing_client_reference");
            }

            int reservationId;
            try {
                reservationId = Integer.parseInt(ref.trim());
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "reservation.payment.invalid_client_reference");
            }

            ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_reservation_not_found"));

            assertReservationOwner(reservation, authentication);

            if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
                reservation.setStatus(ReservationStatus.CONFIRMED);
                reservationRepository.save(reservation);
            }

            ActivityReservationResponse response = reservationService.toResponse(reservation);
            return ResponseEntity.ok(response);
        } catch (StripeException ex) {
            log.warn("Stripe finalize checkout failed", ex);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "reservation.payment.stripe_generic_error");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Finalize activity checkout failed", ex);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "reservation.payment.finalize_failed");
        }
    }

    @GetMapping("/activity-reservations/{reservationId}/qr")
    public ResponseEntity<byte[]> getReservationQr(
        @PathVariable Integer reservationId,
        Authentication authentication
    ) {
        ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_reservation_not_found"));

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
            .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_reservation_not_found"));

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
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "reservation.error.receipt_signature_invalid");
        }

        ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
            .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_reservation_not_found"));

        assertConfirmedReservation(reservation);

        byte[] pdf = activityReceiptPdfService.generateReceiptPdf(reservation);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"yallatn-activity-confirmation.pdf\"")
            .body(pdf);
    }

    @GetMapping(value = "/activity-receipts/{reservationId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> viewReceiptLandingByQr(
            @PathVariable Integer reservationId,
            @RequestParam(name = "sig", required = false) String signature) {
        if (!activityReceiptLinkService.isValidSignature(reservationId, signature)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "reservation.error.receipt_signature_invalid");
        }

        ActivityReservation reservation = reservationRepository.findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_reservation_not_found"));
        assertConfirmedReservation(reservation);

        Activity act = reservation.getActivity();
        int actId = act != null && act.getActivityId() != null ? act.getActivityId() : 0;
        String activityNameRaw = act != null && act.getName() != null ? act.getName() : "";
        String activityName =
                actId > 0
                        ? reservationLabels.activityName(actId, activityNameRaw)
                        : activityNameRaw;

        String cityName =
                reservationLabels.tr(
                        "reservation.confirmation.fallback_city", "Tunisie");
        if (act != null && act.getCity() != null) {
            Integer cid = act.getCity().getCityId();
            String raw = act.getCity().getName() != null ? act.getCity().getName() : "";
            if (cid != null) {
                cityName = reservationLabels.cityName(cid, raw);
            } else if (!raw.isBlank()) {
                cityName = raw;
            }
        }

        String address =
                act != null && act.getActivityId() != null
                        ? reservationLabels.activityAddress(
                                act.getActivityId(),
                                act.getAddress() != null ? act.getAddress() : "")
                        : reservationLabels.tr(
                                "reservation.confirmation.fallback_address", "N/D");
        if (address.isBlank()) {
            address =
                    reservationLabels.tr(
                            "reservation.confirmation.fallback_address", "N/D");
        }

        String imageUrl =
                act == null
                        ? null
                        : activityMediaRepository
                                .findByActivityActivityIdOrderByMediaIdDesc(act.getActivityId())
                                .stream()
                                .map(ActivityMedia::getUrl)
                                .filter(url -> url != null && !url.isBlank())
                                .findFirst()
                                .orElse(null);

        String downloadUrl = activityReceiptLinkService.buildPublicPdfUrl(reservationId);
        String heroAlt =
                reservationLabels.tr(
                        "reservation.confirmation.hero_image_alt", "Image de l’activité");
        String imageBlock =
                (imageUrl != null)
                        ? "<img class=\"hero\" src=\""
                                + esc(imageUrl)
                                + "\" alt=\""
                                + esc(heroAlt)
                                + "\"/>"
                        : "<div class=\"hero-fallback\">" + esc(activityName) + "</div>";

        String pageTitle =
                reservationLabels.tr(
                        "reservation.confirmation.html_title_short", "YallaTN+ — Reçu");
        String headTitle =
                reservationLabels.tr(
                        "reservation.confirmation.receipt_title", "YallaTN+ — Reçu de paiement");
        String headSub =
                reservationLabels.tr(
                        "reservation.confirmation.receipt_sub",
                        "Scan réussi. Téléchargez votre confirmation PDF.");
        String lblActivity =
                reservationLabels.tr(
                        "reservation.confirmation.activity_label", "Activité");
        String lblCity =
                reservationLabels.tr("reservation.confirmation.city_label", "Ville");
        String lblAddress =
                reservationLabels.tr(
                        "reservation.confirmation.address_label", "Adresse");
        String downloadCta =
                reservationLabels.tr(
                        "reservation.confirmation.download_pdf", "Télécharger le PDF");

        String html =
                """
                        <!doctype html>
                        <html lang="en">
                        <head>
                            <meta charset="utf-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                            <title>%s</title>
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
                                        <h1>%s</h1>
                                        <div class="sub">%s</div>
                                    </div>
                                    %s
                                    <div class="body">
                                        <p class="meta"><strong>%s:</strong> %s<br/><strong>%s:</strong> %s<br/><strong>%s:</strong> %s</p>
                                        <a class="btn" href="%s">%s</a>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                        """
                        .formatted(
                                esc(pageTitle),
                                esc(headTitle),
                                esc(headSub),
                                imageBlock,
                                esc(lblActivity),
                                esc(activityName),
                                esc(lblCity),
                                esc(cityName),
                                esc(lblAddress),
                                esc(address),
                                esc(downloadUrl),
                                esc(downloadCta));

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(html.getBytes(StandardCharsets.UTF_8));
    }

    private void assertReservationOwner(ActivityReservation reservation, Authentication authentication) {
        Integer currentUserId = userIdentityResolver.resolveUserId(authentication);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "reservation.error.auth_required");
        }

        User owner = reservation.getUser();
        if (owner == null || owner.getUserId() == null || !owner.getUserId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "reservation.error.receipt_wrong_account");
        }
    }

    private void assertConfirmedReservation(ActivityReservation reservation) {
        if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "reservation.error.receipt_not_confirmed");
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
