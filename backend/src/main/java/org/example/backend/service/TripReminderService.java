package org.example.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TripReminderService {

    private final TransportReservationRepository reservationRepository;
    private final JavaMailSender mailSender;

    @Value("${app.mail.from:${spring.mail.username:no-reply@yallatn.com}}")
    private String fromAddress;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm");

    @Scheduled(cron = "0 0 8 * * *")
    public void sendTripReminders() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDateTime start = tomorrow.atStartOfDay();
        LocalDateTime end = tomorrow.atTime(23, 59, 59);

        List<TransportReservation> upcoming = reservationRepository.findAll().stream()
                .filter(r -> r.getStatus() == TransportReservation.ReservationStatus.CONFIRMED)
                .filter(r -> r.getTravelDate() != null)
                .filter(r -> !r.getTravelDate().isBefore(start) && !r.getTravelDate().isAfter(end))
                .filter(r -> r.getPassengerEmail() != null && !r.getPassengerEmail().isBlank())
                .toList();

        log.info("Trip reminders: {} confirmed reservations for tomorrow ({})", upcoming.size(), tomorrow);

        for (TransportReservation res : upcoming) {
            try {
                sendReminderEmail(res);
                log.info("Reminder sent for ref={}", res.getReservationRef());
            } catch (Exception e) {
                log.error("Failed to send reminder for ref={}: {}", res.getReservationRef(), e.getMessage());
            }
        }
    }

    private void sendReminderEmail(TransportReservation res) {
        String departure = res.getTransport().getDepartureCity().getName();
        String arrival = res.getTransport().getArrivalCity().getName();
        String dateStr = res.getTravelDate().format(FMT);
        String passenger = res.getPassengerFirstName() + " " + res.getPassengerLastName();

        String subject = "YallaTN+ - Rappel : votre voyage " + departure + " → " + arrival + " demain";

        String plainText = String.format(
                "Bonjour %s,\n\nRappel : votre voyage %s → %s est prévu demain le %s.\n"
                        + "Référence : %s\nPlaces : %d\n\nBon voyage !\nÉquipe YallaTN+",
                passenger, departure, arrival, dateStr, res.getReservationRef(), res.getNumberOfSeats()
        );

        String html = buildReminderHtml(passenger, departure, arrival, dateStr,
                res.getReservationRef(), res.getNumberOfSeats(), res.getTotalPrice());

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(res.getPassengerEmail());
            helper.setSubject(subject);
            helper.setText(plainText, html);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new IllegalStateException("Échec envoi rappel email", e);
        }
    }

    private String buildReminderHtml(String passenger, String departure, String arrival,
                                     String date, String ref, int seats, double price) {
        return """
                <!DOCTYPE html>
                <html lang="fr"><head><meta charset="UTF-8"/></head>
                <body style="margin:0;padding:0;background:#f2f6fb;font-family:Arial,sans-serif;color:#102030;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f2f6fb;padding:24px 0;">
                <tr><td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
                    <tr><td style="background:linear-gradient(135deg,#e8002d,#f54f43,#0077b6);padding:24px 30px;color:#fff;">
                        <div style="font-size:24px;font-weight:800;">YallaTN+</div>
                        <div style="margin-top:4px;font-size:13px;opacity:0.9;">Rappel de voyage</div>
                    </td></tr>
                    <tr><td style="padding:24px 30px;">
                        <div style="font-size:16px;">Bonjour <strong>%s</strong>,</div>
                        <div style="margin:16px 0;padding:16px;background:#f8f9fb;border-radius:10px;text-align:center;">
                            <div style="font-size:11px;color:#6a7f98;text-transform:uppercase;">Votre voyage de demain</div>
                            <div style="font-size:22px;font-weight:700;margin:8px 0;">%s &#10132; %s</div>
                            <div style="font-size:14px;color:#3a4d67;">%s</div>
                        </div>
                        <div style="font-size:14px;line-height:1.7;color:#3a4d67;">
                            <strong>Reference :</strong> %s<br/>
                            <strong>Places :</strong> %d<br/>
                            <strong>Prix total :</strong> %.2f TND
                        </div>
                        <div style="margin-top:16px;font-size:14px;color:#3a4d67;">
                            Pensez a arriver en avance et a emporter votre billet. Bon voyage !
                        </div>
                    </td></tr>
                    <tr><td style="padding:14px 30px;background:#f8fbff;border-top:1px solid #e6eef7;text-align:center;font-size:11px;color:#6a7f98;">
                        YallaTN+ &mdash; Tunisia Tourism &amp; Travel Platform
                    </td></tr>
                </table>
                </td></tr></table>
                </body></html>
                """.formatted(esc(passenger), esc(departure), esc(arrival), esc(date),
                esc(ref), seats, price);
    }

    private String esc(String v) {
        if (v == null) return "";
        return v.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
