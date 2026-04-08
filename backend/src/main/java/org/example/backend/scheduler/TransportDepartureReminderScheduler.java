package org.example.backend.scheduler;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.EmailService;
import org.example.backend.service.QrCodeService;
import org.example.backend.service.TransportWhatsAppMessageBuilder;
import org.example.backend.service.TwilioWhatsAppService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class TransportDepartureReminderScheduler {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final TransportReservationRepository reservationRepository;
    private final EmailService emailService;
    private final QrCodeService qrCodeService;
    private final TransportWhatsAppMessageBuilder transportWhatsAppMessageBuilder;
    private final TwilioWhatsAppService twilioWhatsAppService;

    @Value("${app.transport.reminder-one-hour-window-minutes:2}")
    private int reminderWindowMinutes;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void sendOneHourReminders() {
        LocalDateTime now = LocalDateTime.now();
        log.info("Reminder scheduler fired at {} — checking window now+14m to now+16m", now);
        // TODO: revert to now+59min / now+61min before production (target = now.plusHours(1))
        LocalDateTime target = now.plusMinutes(15);
        int half = Math.max(1, reminderWindowMinutes) / 2;
        LocalDateTime start = target.minusMinutes(half);
        LocalDateTime end = target.plusMinutes(half);

        List<TransportReservation> due = reservationRepository.findDueForOneHourReminder(start, end);
        for (TransportReservation r : due) {
            try {
                if (r.getPassengerEmail() == null || r.getPassengerEmail().isBlank()) {
                    r.setReminderOneHourSent(true);
                    reservationRepository.save(r);
                    continue;
                }
                String route = buildRouteLabel(r);
                String when = r.getTravelDate() != null ? r.getTravelDate().format(FMT) : "";
                String qrJson = buildQrPayload(r, when);
                byte[] png = qrCodeService.generateQrPng(qrJson, 280);
                emailService.sendTransportOneHourReminder(
                        r.getPassengerEmail().trim(),
                        r.getPassengerFirstName(),
                        r.getReservationRef() != null ? r.getReservationRef() : "",
                        route,
                        when,
                        png);
                try {
                    String msg = transportWhatsAppMessageBuilder.buildReminderMessage(r);
                    twilioWhatsAppService.sendWhatsApp(
                            r.getUser() != null ? r.getUser().getPhone() : null, msg);
                    log.info("WhatsApp reminder sent for reservation {}", r.getTransportReservationId());
                } catch (Exception e) {
                    log.warn(
                            "WhatsApp reminder skipped for {}: {}",
                            r.getTransportReservationId(),
                            e.getMessage());
                }
                r.setReminderOneHourSent(true);
                reservationRepository.save(r);
            } catch (Exception e) {
                log.error("Transport reminder failed for reservation {}", r.getTransportReservationId(), e);
                throw e;
            }
        }
    }

    private static String buildRouteLabel(TransportReservation r) {
        if (r.getTransport() == null) {
            return "";
        }
        String a = r.getTransport().getDepartureCity() != null && r.getTransport().getDepartureCity().getName() != null
                ? r.getTransport().getDepartureCity().getName()
                : "";
        String b = r.getTransport().getArrivalCity() != null && r.getTransport().getArrivalCity().getName() != null
                ? r.getTransport().getArrivalCity().getName()
                : "";
        return a + " → " + b;
    }

    private static String buildQrPayload(TransportReservation r, String whenLabel) {
        String fn = r.getPassengerFirstName() != null ? r.getPassengerFirstName() : "";
        String ln = r.getPassengerLastName() != null ? r.getPassengerLastName() : "";
        String ref = r.getReservationRef() != null ? r.getReservationRef() : "";
        String route = buildRouteLabel(r);
        return String.format(
                "{\"ref\":\"%s\",\"passenger\":\"%s %s\",\"route\":\"%s\",\"date\":\"%s\"}",
                ref.replace("\"", "\\\""),
                fn.replace("\"", "\\\""),
                ln.replace("\"", "\\\""),
                route.replace("\"", "\\\""),
                whenLabel.replace("\"", "\\\""));
    }
}
