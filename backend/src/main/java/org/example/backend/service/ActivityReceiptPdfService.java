package org.example.backend.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.ActivityReservation;
import org.example.backend.model.User;
import org.example.backend.repository.ActivityMediaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityReceiptPdfService {

    private final QrCodeService qrCodeService;
    private final ActivityReceiptLinkService activityReceiptLinkService;
    private final ActivityMediaRepository activityMediaRepository;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public byte[] generateReceiptPdf(ActivityReservation reservation) {
        String qrContent = buildQrContent(reservation);
        return generateReceiptPdf(reservation, qrContent);
    }

    public byte[] generateReceiptPdf(ActivityReservation reservation, String qrContent) {
        byte[] qrPng = qrCodeService.generateQrPng(qrContent, 200);
        String qrBase64 = Base64.getEncoder().encodeToString(qrPng);
        String html = buildHtml(reservation, qrBase64);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            Integer reservationId = reservation.getActivityReservationId();
            log.error("Activity receipt PDF generation failed for reservationId={}", reservationId, e);
            throw new IllegalStateException("Unable to generate activity receipt PDF", e);
        }
    }

    public String buildQrContent(ActivityReservation reservation) {
        return activityReceiptLinkService.buildPublicPdfUrl(reservation.getActivityReservationId());
    }

    private String buildHtml(ActivityReservation reservation, String qrBase64) {
        String date = reservation.getReservationDate() != null
            ? reservation.getReservationDate().toInstant().atOffset(ZoneOffset.UTC).toLocalDate().format(DATE_FMT)
            : "N/A";

        String activityName = reservation.getActivity() != null ? reservation.getActivity().getName() : "Activity";
        String cityName = reservation.getActivity() != null && reservation.getActivity().getCity() != null
            ? reservation.getActivity().getCity().getName()
            : "N/A";
        String address = reservation.getActivity() != null && reservation.getActivity().getAddress() != null
            ? reservation.getActivity().getAddress().trim()
            : "N/A";

        String customer = buildTravelerName(reservation.getUser());
        String customerEmail = reservation.getUser() != null && reservation.getUser().getEmail() != null
            ? reservation.getUser().getEmail().trim()
            : "N/A";

        int people = reservation.getNumberOfPeople() != null ? reservation.getNumberOfPeople() : 0;
        double total = reservation.getTotalPrice() != null ? reservation.getTotalPrice() : 0.0;
        String status = reservation.getStatus() != null ? reservation.getStatus().name() : "PENDING";

        String normalizedBase = normalizeBaseUrl(frontendBaseUrl);
        String logoUrl = normalizedBase + "/assets/logo/yallatn-logo.png";
        String logoDataUri = resolveImageAsDataUri(logoUrl);
        List<String> activityImages = collectActivityImageUrls(reservation);
        String heroImageBlock = buildHeroImageBlock(activityImages, activityName, cityName);
        String logoBlock = logoDataUri != null
            ? "<img class=\"brand-logo\" src=\"" + logoDataUri + "\" alt=\"YallaTN logo\"/>"
            : "<div class=\"brand-fallback\">YallaTN+</div>";

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"/><style>
                body { font-family: Helvetica, Arial, sans-serif; margin: 12px; color: #1f2a37; font-size: 12px; background: #eef3f8; }
                .card { border: 1px solid #d4e0ec; max-width: 690px; margin: 0 auto; border-radius: 18px; overflow: hidden; background: #ffffff; }
                .head { background: linear-gradient(135deg, #113b57 0%%, #16607e 55%%, #1b7596 100%%); color: #ffffff; padding: 16px 18px; }
                .brand { min-height: 56px; }
                .brand-logo { height: 52px; width: auto; display: block; }
                .brand-fallback { font-weight: 800; font-size: 28px; letter-spacing: 0.5px; color: #ffffff; }
                .head p { margin: 8px 0 0; font-size: 11px; color: #eaf4fc; }
                .hero { height: 220px; width: 100%%; overflow: hidden; background: #e6edf4; border-bottom: 1px solid #dbe6f0; }
                .hero img { width: 100%%; height: 220px; display: block; }
                .hero.placeholder { background: #1b4965; color:#ffffff; height: 120px; text-align: center; padding-top: 30px; }
                .hero-title { font-size: 28px; font-weight: 800; margin-bottom: 8px; text-align:center; }
                .hero-sub { font-size: 14px; color: #f2f8ff; }
                .content { padding: 18px 20px 20px; }
                .badge { background: #fff2f5; border: 1px solid #ffc8d4; padding: 9px 10px; margin-bottom: 12px; border-radius: 10px; text-align: center; }
                .badge strong { font-size: 16px; color: #c51f47; }
                table { width: 100%%; border-collapse: collapse; margin-top: 10px; border: 1px solid #dbe6f0; border-radius: 8px; overflow: hidden; }
                td { padding: 8px 10px; border-bottom: 1px solid #edf2f7; }
                tr:last-child td { border-bottom: 0; }
                td.label { color: #4e6a86; width: 40%%; background: #f7fbff; font-weight: 600; }
                td.value { text-align: right; font-weight: 700; color: #18293a; }
                .qr { text-align: center; margin-top: 18px; border-top: 1px dashed #c8d9e8; padding-top: 14px; }
                .qr img { width: 176px; height: 176px; border: 1px solid #d9e6f2; border-radius: 10px; padding: 4px; background: #fff; }
                .qr-note { font-size: 10px; color: #56718b; margin-top: 6px; }
                .foot { background-color: #f8fafc; padding: 10px 16px; text-align: center; font-size: 10px; color: #56718b; border-top: 1px solid #dbe6f0; }
            </style></head>
            <body>
                <div class="card">
                    <div class="head">
                        <div class="brand">
                            %s
                        </div>
                        <p>Payment receipt | Activity booking confirmation</p>
                    </div>
                    %s
                    <div class="content">
                        <div class="badge">
                            <strong>Payment confirmed</strong>
                        </div>
                        <table>
                            <tr><td class="label">Activity</td><td class="value">%s</td></tr>
                            <tr><td class="label">City</td><td class="value">%s</td></tr>
                            <tr><td class="label">Address</td><td class="value">%s</td></tr>
                            <tr><td class="label">Traveler</td><td class="value">%s</td></tr>
                            <tr><td class="label">Email</td><td class="value">%s</td></tr>
                            <tr><td class="label">Date</td><td class="value">%s</td></tr>
                            <tr><td class="label">Participants</td><td class="value">%d</td></tr>
                            <tr><td class="label">Payment status</td><td class="value">%s</td></tr>
                            <tr><td class="label">Total paid</td><td class="value">%.2f TND</td></tr>
                        </table>
                        <div class="qr">
                            <img src="data:image/png;base64,%s" alt="QR"/>
                            <div class="qr-note">Scan to download this receipt PDF</div>
                        </div>
                    </div>
                    <div class="foot">YallaTN+ | Tunisia travel experiences</div>
                </div>
            </body>
            </html>
            """.formatted(
            logoBlock,
            heroImageBlock,
            esc(activityName),
            esc(cityName),
            esc(address),
            esc(customer),
            esc(customerEmail),
            esc(date),
            people,
            esc(status),
            total,
            qrBase64
        );
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

    private String buildTravelerName(User user) {
        if (user == null) {
            return "Traveler";
        }
        String firstName = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String lastName = user.getLastName() != null ? user.getLastName().trim() : "";
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }
        return "Traveler";
    }

    private String normalizeBaseUrl(String baseUrl) {
        String base = baseUrl == null ? "http://localhost:4200" : baseUrl.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private List<String> collectActivityImageUrls(ActivityReservation reservation) {
        if (reservation == null || reservation.getActivity() == null) {
            return List.of();
        }
        return activityMediaRepository.findByActivityActivityIdOrderByMediaIdDesc(reservation.getActivity().getActivityId())
            .stream()
            .map(ActivityMedia::getUrl)
            .filter(url -> url != null && !url.isBlank())
            .limit(1)
            .toList();
    }

    private String buildHeroImageBlock(List<String> images, String activityName, String cityName) {
        if (images != null && !images.isEmpty()) {
            return "<div class=\"hero\"><img src=\"" + esc(images.get(0)) + "\" alt=\"Activity image\"/></div>";
        }
        return "<div class=\"hero placeholder\">\n"
            + "  <div class=\"hero-title\">" + esc(activityName) + "</div>\n"
            + "  <div class=\"hero-sub\">" + esc(cityName) + "</div>\n"
            + "</div>";
    }

    private String resolveImageAsDataUri(String url) {
        if (url == null || url.isBlank()) {
            return resolveLocalLogoAsDataUri();
        }
        try (InputStream in = new URL(url).openStream()) {
            byte[] bytes = in.readAllBytes();
            if (bytes.length == 0) {
                return resolveLocalLogoAsDataUri();
            }
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (Exception ignored) {
            return resolveLocalLogoAsDataUri();
        }
    }

    private String resolveLocalLogoAsDataUri() {
        try (InputStream in = ActivityReceiptPdfService.class.getClassLoader().getResourceAsStream("static/assets/logo/yallatn-logo.png")) {
            if (in != null) {
                byte[] bytes = in.readAllBytes();
                if (bytes.length > 0) {
                    return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
                }
            }
        } catch (Exception ignored) {
            // Continue with file-system fallbacks
        }

        List<Path> candidates = List.of(
            Paths.get("..", "frontend", "src", "assets", "logo", "yallatn-logo.png"),
            Paths.get("..", "frontend", "public", "assets", "logo", "yallatn-logo.png"),
            Paths.get("src", "main", "resources", "static", "assets", "logo", "yallatn-logo.png")
        );

        for (Path candidate : candidates) {
            try {
                if (Files.exists(candidate) && Files.isRegularFile(candidate)) {
                    byte[] bytes = Files.readAllBytes(candidate);
                    if (bytes.length > 0) {
                        return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
                    }
                }
            } catch (Exception ignored) {
                // Try next fallback path
            }
        }
        return null;
    }

}
