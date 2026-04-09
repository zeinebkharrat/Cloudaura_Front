package org.example.backend.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;

/**
 * Transport ticket PDF from HTML/CSS template ({@code /ticket/transport-ticket.html}) via OpenHTMLToPDF.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketPdfService {

    private final QrCodeService qrCodeService;

    @Value("${app.ticket.support-email:support@yallatn.com}")
    private String supportEmail;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    @Value("${app.ticket.support-phone:}")
    private String supportPhone;

    private static final DateTimeFormatter DATE_EN = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter GEN_FR = DateTimeFormatter.ofPattern("dd MMM yyyy 'à' HH:mm", Locale.FRENCH);

    public byte[] generateTicketPdf(TransportReservationResponse r) {
        int bookingId = r.getTransportReservationId();
        int transportId = r.getTransportId() != null ? r.getTransportId() : 0;
        String qrPayload = String.format("{\"bookingId\":%d,\"transportId\":%d}", bookingId, transportId);
        byte[] qrPng = qrCodeService.generateQrPng(qrPayload, 200);
        String qrDataUri = "data:image/png;base64," + Base64.getEncoder().encodeToString(qrPng);

        String ref = r.getReservationRef() != null ? r.getReservationRef() : "";
        String barcodeContent = barcodePayload(ref, bookingId);
        byte[] bcPng = qrCodeService.generateCode128Png(barcodeContent, 380, 64);
        String barcodeDataUri = "data:image/png;base64," + Base64.getEncoder().encodeToString(bcPng);

        String html;
        try {
            html = buildHtml(r, qrDataUri, barcodeDataUri, barcodeContent);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger le modele ticket HTML", e);
        }

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("PDF ticket generation failed for ref={}", r.getReservationRef(), e);
            throw new IllegalStateException("Impossible de générer le ticket PDF", e);
        }
    }

    private String buildHtml(TransportReservationResponse r, String qrDataUri, String barcodeDataUri, String barcodeText)
            throws IOException {
        String template;
        try (InputStream in = TicketPdfService.class.getResourceAsStream("/ticket/transport-ticket.html")) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource /ticket/transport-ticket.html");
            }
            template = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        String dep = nvl(r.getDepartureCityName());
        String arr = nvl(r.getArrivalCityName());
        String depU = dep.toUpperCase(Locale.ROOT);
        String arrU = arr.toUpperCase(Locale.ROOT);

        String travelDateStr = "—";
        String travelTimeStr = "—";
        if (r.getTravelDate() != null) {
            travelDateStr = r.getTravelDate().format(DATE_EN);
            travelTimeStr = r.getTravelDate().format(TIME_FMT);
        }

        String total = String.format("%.2f TND", r.getTotalPrice());
        String ref = r.getReservationRef() != null ? r.getReservationRef() : "";
        String styledRef = ref.startsWith("#") ? ref : "#" + ref;

        String[] status = mapStatusBadge(r.getStatus());
        String statusBadgeHtml = "<span class=\"bp-status " + status[0] + "\">" + esc(status[1]) + esc(status[2]) + "</span>";

        String payLine = esc(nvl(r.getPaymentStatus())) + " · " + esc(nvl(r.getPaymentMethod()));

        String passenger = nvl(r.getPassengerFullName()).toUpperCase(Locale.ROOT);
        String[] stubNames = passengerStubNames(r);

        String email = supportEmail != null ? supportEmail : "support@yallatn.com";
        String stubContact = stubSupportContact(email);

        return template
                .replace("__LOGO_HTML__", buildLogoHtml())
                .replace("__STATUS_BADGE_HTML__", statusBadgeHtml)
                .replace("__PASSENGER__", esc(passenger))
                .replace("__PASSENGER_FIRST_STUB__", esc(stubNames[0]))
                .replace("__PASSENGER_LAST_STUB__", esc(stubNames[1]))
                .replace("__BOOKING_REF__", esc(ref))
                .replace("__STYLED_REF__", esc(styledRef))
                .replace("__PAYMENT_LINE__", payLine)
                .replace("__DEP_U__", esc(depU))
                .replace("__ARR_U__", esc(arrU))
                .replace("__DEP_CODE__", esc(cityCode(dep)))
                .replace("__ARR_CODE__", esc(cityCode(arr)))
                .replace("__TRAVEL_DATE__", esc(travelDateStr))
                .replace("__TRAVEL_TIME__", esc(travelTimeStr))
                .replace("__SEATS__", esc(String.valueOf(r.getNumberOfSeats())))
                .replace("__TRANSPORT_TYPE__", esc(transportTypeLabel(r.getTransportType())))
                .replace("__TOTAL_PRICE__", esc(total))
                .replace("__QR_DATA_URI__", qrDataUri)
                .replace("__BARCODE_DATA_URI__", barcodeDataUri)
                .replace("__BARCODE_TEXT__", esc(barcodeText))
                .replace("__SITE_DISPLAY__", esc(siteDisplayUrl(frontendBaseUrl)))
                .replace("__STUB_SUPPORT_CONTACT__", stubContact)
                .replace("__GENERATED_AT__", esc(LocalDateTime.now().format(GEN_FR)));
    }

    private String stubSupportContact(String email) {
        StringBuilder sb = new StringBuilder();
        if (supportPhone != null && !supportPhone.isBlank()) {
            sb.append("Tél. ").append(esc(supportPhone.trim())).append("<br/>");
        }
        sb.append(esc(email));
        return sb.toString();
    }

    private static String barcodePayload(String ref, int bookingId) {
        String raw = ref == null ? "" : ref.trim();
        if (raw.startsWith("#")) {
            raw = raw.substring(1);
        }
        if (!raw.isEmpty() && raw.chars().allMatch(c -> c < 128)) {
            return raw;
        }
        return "YT-" + bookingId;
    }

    private static String siteDisplayUrl(String base) {
        if (base == null || base.isBlank()) {
            return "yallatn.com";
        }
        String u = base.trim().replaceAll("/+$", "");
        return u.replaceFirst("^https?://", "");
    }

    /** [firstNameOrRemainder, lastName] for tear-off stub */
    private static String[] passengerStubNames(TransportReservationResponse r) {
        String f = nvl(r.getPassengerFirstName()).trim();
        String l = nvl(r.getPassengerLastName()).trim();
        if (!f.isEmpty() || !l.isEmpty()) {
            return new String[]{
                    f.isEmpty() ? "—" : f.toUpperCase(Locale.ROOT),
                    l.isEmpty() ? "—" : l.toUpperCase(Locale.ROOT)
            };
        }
        String full = nvl(r.getPassengerFullName()).trim();
        if (full.isEmpty()) {
            return new String[]{"—", "—"};
        }
        String[] parts = full.split("\\s+");
        if (parts.length == 1) {
            return new String[]{"—", parts[0].toUpperCase(Locale.ROOT)};
        }
        String last = parts[parts.length - 1];
        StringBuilder first = new StringBuilder();
        for (int i = 0; i < parts.length - 1; i++) {
            if (i > 0) {
                first.append(' ');
            }
            first.append(parts[i]);
        }
        return new String[]{first.toString().toUpperCase(Locale.ROOT), last.toUpperCase(Locale.ROOT)};
    }

    private String buildLogoHtml() {
        try (InputStream in = TicketPdfService.class.getResourceAsStream("/branding/yallatn-logo.png")) {
            if (in == null) {
                return "<div class=\"brand-logo-fallback\">YallaTN<sup>+</sup></div>";
            }
            byte[] bytes = in.readAllBytes();
            if (bytes.length == 0) {
                return "<div class=\"brand-logo-fallback\">YallaTN<sup>+</sup></div>";
            }
            String b64 = Base64.getEncoder().encodeToString(bytes);
            return "<img class=\"brand-logo-img\" src=\"data:image/png;base64," + b64 + "\" alt=\"YallaTN+\"/>";
        } catch (IOException e) {
            log.warn("Could not load /branding/yallatn-logo.png: {}", e.getMessage());
            return "<div class=\"brand-logo-fallback\">YallaTN<sup>+</sup></div>";
        }
    }

    /** [cssClass, iconPrefix, labelUppercase] */
    private static String[] mapStatusBadge(String status) {
        if (status == null) {
            return new String[]{"badge--neutral", "", "INCONNU"};
        }
        String u = status.toUpperCase(Locale.ROOT);
        if (u.contains("CONFIRM")) {
            return new String[]{"badge--ok", "\u2713 ", "CONFIRMÉ"};
        }
        if (u.contains("CANCEL")) {
            return new String[]{"badge--cancel", "", "ANNULÉ"};
        }
        if (u.contains("PEND")) {
            return new String[]{"badge--pending", "", "EN ATTENTE"};
        }
        return new String[]{"badge--neutral", "", status.toUpperCase(Locale.ROOT)};
    }

    private static String cityCode(String name) {
        if (name == null || name.isBlank()) {
            return "---";
        }
        String first = name.trim().split("\\s+")[0];
        String ascii = Normalizer.normalize(first, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        String letters = ascii.replaceAll("[^a-zA-Z]", "");
        if (letters.length() >= 3) {
            return letters.substring(0, 3).toUpperCase(Locale.ROOT);
        }
        if (letters.length() >= 1) {
            return (letters + "XX").substring(0, 3).toUpperCase(Locale.ROOT);
        }
        return "---";
    }

    private static String transportTypeLabel(String code) {
        if (code == null || code.isBlank()) {
            return "—";
        }
        return switch (code.toUpperCase(Locale.ROOT)) {
            case "BUS" -> "Bus";
            case "TAXI" -> "Taxi";
            case "VAN" -> "Louage / Van VIP";
            case "CAR" -> "Voiture (privée)";
            case "PLANE" -> "Avion";
            case "TRAIN" -> "Train";
            case "FERRY" -> "Ferry";
            default -> code;
        };
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String nvl(String s) {
        return s != null ? s : "";
    }
}
