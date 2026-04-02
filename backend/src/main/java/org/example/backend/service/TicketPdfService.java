package org.example.backend.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketPdfService {

    private final QrCodeService qrCodeService;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public byte[] generateTicketPdf(TransportReservationResponse reservation) {
        String qrContent = String.format(
                "{\"ref\":\"%s\",\"passenger\":\"%s\",\"route\":\"%s → %s\",\"date\":\"%s\",\"seats\":%d}",
                reservation.getReservationRef(),
                reservation.getPassengerFullName(),
                reservation.getDepartureCityName(),
                reservation.getArrivalCityName(),
                reservation.getTravelDate() != null ? reservation.getTravelDate().format(DATE_FMT) : "N/A",
                reservation.getNumberOfSeats()
        );

        byte[] qrPng = qrCodeService.generateQrPng(qrContent, 200);
        String qrBase64 = Base64.getEncoder().encodeToString(qrPng);

        String html = buildTicketHtml(reservation, qrBase64);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("PDF ticket generation failed for ref={}", reservation.getReservationRef(), e);
            throw new IllegalStateException("Impossible de générer le ticket PDF", e);
        }
    }

    private String buildTicketHtml(TransportReservationResponse r, String qrBase64) {
        String travelDate = r.getTravelDate() != null ? r.getTravelDate().format(DATE_FMT) : "N/A";
        String createdAt = r.getCreatedAt() != null ? r.getCreatedAt().format(DATE_FMT) : "N/A";

        return """
                <!DOCTYPE html>
                <html lang="fr">
                <head><meta charset="UTF-8"/><style>
                    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #1a1a2e; }
                    .ticket { width: 100%%; max-width: 600px; margin: 0 auto; border: 2px solid #e8002d; border-radius: 16px; overflow: hidden; }
                    .header { background: linear-gradient(135deg, #e8002d 0%%, #f54f43 60%%, #0077b6 100%%); color: white; padding: 24px 30px; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
                    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
                    .body { padding: 24px 30px; }
                    .ref { background: #f8f9fb; border: 1px solid #e0e6ed; border-radius: 10px; padding: 14px 20px; margin-bottom: 20px; text-align: center; }
                    .ref span { font-size: 22px; font-weight: 700; color: #e8002d; letter-spacing: 2px; }
                    .route { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 18px 0; }
                    .city { text-align: center; }
                    .city .name { font-size: 20px; font-weight: 700; }
                    .city .label { font-size: 11px; color: #6a7f98; text-transform: uppercase; }
                    .arrow { font-size: 28px; color: #0077b6; }
                    .details { border-top: 1px dashed #d0d7e2; padding-top: 16px; margin-top: 16px; }
                    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
                    .row .label { color: #6a7f98; }
                    .row .value { font-weight: 600; }
                    .qr { text-align: center; padding: 20px 0; border-top: 1px dashed #d0d7e2; margin-top: 16px; }
                    .qr img { width: 160px; height: 160px; }
                    .footer { background: #f8f9fb; padding: 14px 30px; text-align: center; font-size: 11px; color: #6a7f98; border-top: 1px solid #e0e6ed; }
                </style></head>
                <body>
                <div class="ticket">
                    <div class="header">
                        <h1>YallaTN+</h1>
                        <p>Billet de transport electronique</p>
                    </div>
                    <div class="body">
                        <div class="ref">
                            <div style="font-size:11px;color:#6a7f98;text-transform:uppercase;margin-bottom:4px;">Reference</div>
                            <span>%s</span>
                        </div>
                        <div class="route">
                            <div class="city">
                                <div class="label">Depart</div>
                                <div class="name">%s</div>
                            </div>
                            <div class="arrow">&#10132;</div>
                            <div class="city">
                                <div class="label">Arrivee</div>
                                <div class="name">%s</div>
                            </div>
                        </div>
                        <div class="details">
                            <div class="row"><span class="label">Passager</span><span class="value">%s</span></div>
                            <div class="row"><span class="label">Date de voyage</span><span class="value">%s</span></div>
                            <div class="row"><span class="label">Places</span><span class="value">%d</span></div>
                            <div class="row"><span class="label">Statut</span><span class="value">%s</span></div>
                            <div class="row"><span class="label">Paiement</span><span class="value">%s</span></div>
                            <div class="row"><span class="label">Prix total</span><span class="value">%.2f TND</span></div>
                            <div class="row"><span class="label">Reserve le</span><span class="value">%s</span></div>
                        </div>
                        <div class="qr">
                            <img src="data:image/png;base64,%s" alt="QR Code"/>
                            <div style="font-size:11px;color:#6a7f98;margin-top:6px;">Scannez pour verifier votre billet</div>
                        </div>
                    </div>
                    <div class="footer">
                        YallaTN+ &mdash; Tunisia Tourism &amp; Travel Platform &mdash; Bon voyage !
                    </div>
                </div>
                </body></html>
                """.formatted(
                esc(r.getReservationRef()),
                esc(r.getDepartureCityName()),
                esc(r.getArrivalCityName()),
                esc(r.getPassengerFullName()),
                esc(travelDate),
                r.getNumberOfSeats(),
                esc(r.getStatus()),
                esc(r.getPaymentStatus()),
                r.getTotalPrice(),
                esc(createdAt),
                qrBase64
        );
    }

    private String esc(String v) {
        if (v == null) return "";
        return v.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
