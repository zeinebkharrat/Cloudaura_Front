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
        double price = r.getTotalPrice();
        int seats = r.getNumberOfSeats();

        return """
                <!DOCTYPE html>
                <html lang="fr">
                <head><meta charset="UTF-8"/><style>
                    body { font-family: Helvetica, Arial, sans-serif; margin: 12px; color: #1a1a2e; font-size: 12px; }
                    .ticket { border: 2px solid #e8002d; max-width: 600px; margin: 0 auto; }
                    .header { background-color: #e8002d; color: #ffffff; padding: 16px 20px; }
                    .header h1 { margin: 0; font-size: 22px; }
                    .header p { margin: 6px 0 0; font-size: 11px; }
                    .body { padding: 16px 20px; }
                    .ref { background-color: #f8f9fb; border: 1px solid #e0e6ed; padding: 12px; margin-bottom: 14px; text-align: center; }
                    .ref-big { font-size: 18px; font-weight: bold; color: #e8002d; }
                    table.route { width: 100%%; border-collapse: collapse; margin: 12px 0; }
                    table.route td { text-align: center; vertical-align: middle; padding: 8px; }
                    .city-label { font-size: 10px; color: #6a7f98; text-transform: uppercase; }
                    .city-name { font-size: 16px; font-weight: bold; }
                    .arrow { font-size: 22px; color: #0077b6; }
                    table.details { width: 100%%; border-collapse: collapse; border-top: 1px dashed #d0d7e2; margin-top: 12px; }
                    table.details td { padding: 5px 0; font-size: 12px; }
                    td.lbl { color: #6a7f98; width: 42%%; }
                    td.val { font-weight: bold; text-align: right; }
                    .qr { text-align: center; padding: 16px 0; border-top: 1px dashed #d0d7e2; margin-top: 12px; }
                    .qr img { width: 160px; height: 160px; }
                    .footer { background-color: #f8f9fb; padding: 10px 16px; text-align: center; font-size: 10px; color: #6a7f98; border-top: 1px solid #e0e6ed; }
                </style></head>
                <body>
                <div class="ticket">
                    <div class="header">
                        <h1>YallaTN+</h1>
                        <p>Billet de transport electronique</p>
                    </div>
                    <div class="body">
                        <div class="ref">
                            <div class="city-label">Reference</div>
                            <div class="ref-big">%s</div>
                        </div>
                        <table class="route">
                            <tr>
                                <td>
                                    <div class="city-label">Depart</div>
                                    <div class="city-name">%s</div>
                                </td>
                                <td class="arrow">&#8594;</td>
                                <td>
                                    <div class="city-label">Arrivee</div>
                                    <div class="city-name">%s</div>
                                </td>
                            </tr>
                        </table>
                        <table class="details">
                            <tr><td class="lbl">Passager</td><td class="val">%s</td></tr>
                            <tr><td class="lbl">Date de voyage</td><td class="val">%s</td></tr>
                            <tr><td class="lbl">Places</td><td class="val">%d</td></tr>
                            <tr><td class="lbl">Statut</td><td class="val">%s</td></tr>
                            <tr><td class="lbl">Paiement</td><td class="val">%s</td></tr>
                            <tr><td class="lbl">Prix total</td><td class="val">%.2f TND</td></tr>
                            <tr><td class="lbl">Reserve le</td><td class="val">%s</td></tr>
                        </table>
                        <div class="qr">
                            <img src="data:image/png;base64,%s" alt="QR"/>
                            <div style="font-size:10px;color:#6a7f98;margin-top:6px;">Scannez pour verifier votre billet</div>
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
                seats,
                esc(r.getStatus()),
                esc(r.getPaymentStatus()),
                price,
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
