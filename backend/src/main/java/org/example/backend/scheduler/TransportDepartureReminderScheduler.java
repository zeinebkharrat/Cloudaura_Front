package org.example.backend.scheduler;

import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.TransportWhatsAppMessageBuilder;
import org.example.backend.service.TwilioWhatsAppService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class TransportDepartureReminderScheduler {

    private final TransportReservationRepository reservationRepository;
    private final TransportWhatsAppMessageBuilder transportWhatsAppMessageBuilder;
    private final TwilioWhatsAppService twilioWhatsAppService;

    @Scheduled(fixedRate = 180000)
    @Transactional
    public void sendOneHourReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = now.plusMinutes(30);
        LocalDateTime end = now.plusHours(1);
        log.info(
                "Reminder scheduler fired at {} — checking departures in window [{} .. {})",
                now,
                start,
                end);

        List<TransportReservation> due = reservationRepository.findDueForOneHourReminder(start, end);
        log.info("Found {} reservation(s) due for one-hour reminder", due.size());
        for (TransportReservation r : due) {
            try {
                try {
                    String msg = transportWhatsAppMessageBuilder.buildReminderMessage(r);
                    log.debug("Sending WhatsApp reminder for reservation {}", r.getTransportReservationId());
                    twilioWhatsAppService.sendWhatsApp(
                            preferredPhone(r), msg);
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

    private static String preferredPhone(TransportReservation r) {
        if (r == null) {
            return null;
        }
        if (r.getPassengerPhone() != null && !r.getPassengerPhone().isBlank()) {
            return r.getPassengerPhone();
        }
        return r.getUser() != null ? r.getUser().getPhone() : null;
    }
}
