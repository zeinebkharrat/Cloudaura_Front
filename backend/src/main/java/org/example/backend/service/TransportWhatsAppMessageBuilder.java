package org.example.backend.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class TransportWhatsAppMessageBuilder {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    public String buildConfirmationMessage(TransportReservation reservation) {
        try {
            if (reservation == null) {
                return "";
            }
            String reference =
                    reservation.getReservationRef() != null && !reservation.getReservationRef().isBlank()
                            ? reservation.getReservationRef()
                            : "TR-" + reservation.getTransportReservationId();
            String fromCity = "";
            String toCity = "";
            Transport t = reservation.getTransport();
            if (t != null) {
                if (t.getDepartureCity() != null && t.getDepartureCity().getName() != null) {
                    fromCity = t.getDepartureCity().getName();
                }
                if (t.getArrivalCity() != null && t.getArrivalCity().getName() != null) {
                    toCity = t.getArrivalCity().getName();
                }
            }
            LocalDateTime travel = reservation.getTravelDate();
            if (travel == null) {
                travel = LocalDateTime.now();
            }
            String dayName = travel.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.FRENCH);
            String monthName = travel.getMonth().getDisplayName(TextStyle.FULL, Locale.FRENCH);
            int day = travel.getDayOfMonth();
            int year = travel.getYear();
            String hhmm = travel.format(TIME_FMT);
            int seats = reservation.getNumberOfSeats() != null ? reservation.getNumberOfSeats() : 0;
            double total = reservation.getTotalPrice() != null ? reservation.getTotalPrice() : 0.0;
            String totalStr = String.format(Locale.FRENCH, "%.2f", total);
            return String.format(
                    Locale.FRENCH,
                    "✅ Réservation %s confirmée%n"
                            + "🚌 %s → %s%n"
                            + "📅 %s %d %s %d — %s%n"
                            + "👥 %d passager(s) — %s TND%n"
                            + "Bon voyage ! 🇹🇳",
                    reference,
                    fromCity,
                    toCity,
                    capitalizeFrenchDay(dayName),
                    day,
                    monthName,
                    year,
                    hhmm,
                    seats,
                    totalStr);
        } catch (Exception e) {
            log.warn("buildConfirmationMessage failed: {}", e.getMessage());
            return "";
        }
    }

    public String buildReminderMessage(TransportReservation reservation) {
        try {
            if (reservation == null) {
                return "";
            }
            String fromCity = "";
            String toCity = "";
            Transport t = reservation.getTransport();
            if (t != null) {
                if (t.getDepartureCity() != null && t.getDepartureCity().getName() != null) {
                    fromCity = t.getDepartureCity().getName();
                }
                if (t.getArrivalCity() != null && t.getArrivalCity().getName() != null) {
                    toCity = t.getArrivalCity().getName();
                }
            }
            LocalDateTime travel = reservation.getTravelDate();
            if (travel == null) {
                travel = LocalDateTime.now();
            }
            String hhmm = travel.format(TIME_FMT);
            Integer id = reservation.getTransportReservationId();
            String refSuffix = id != null ? String.valueOf(id) : "?";
            return String.format(
                    Locale.FRENCH,
                    "⏰ Rappel YallaTN+%n"
                        + "Départ après 1 h (prévu à %s)%n"
                        + "🚌 %s → %s%n"
                            + "Référence : TR-%s",
                    hhmm,
                    fromCity,
                    toCity,
                    refSuffix);
        } catch (Exception e) {
            log.warn("buildReminderMessage failed: {}", e.getMessage());
            return "";
        }
    }

    public String buildBookingCreatedMessage(TransportReservation reservation) {
        try {
            if (reservation == null) {
                return "";
            }
            String reference =
                    reservation.getReservationRef() != null && !reservation.getReservationRef().isBlank()
                            ? reservation.getReservationRef()
                            : "TR-" + reservation.getTransportReservationId();
            String fromCity = "";
            String toCity = "";
            Transport t = reservation.getTransport();
            if (t != null) {
                if (t.getDepartureCity() != null && t.getDepartureCity().getName() != null) {
                    fromCity = t.getDepartureCity().getName();
                }
                if (t.getArrivalCity() != null && t.getArrivalCity().getName() != null) {
                    toCity = t.getArrivalCity().getName();
                }
            }
            LocalDateTime travel = reservation.getTravelDate();
            if (travel == null) {
                travel = LocalDateTime.now();
            }
            String hhmm = travel.format(TIME_FMT);
            int seats = reservation.getNumberOfSeats() != null ? reservation.getNumberOfSeats() : 0;
            return String.format(
                    Locale.FRENCH,
                    "📩 Réservation transport reçue%n"
                            + "Référence : %s%n"
                            + "🚌 %s → %s à %s%n"
                            + "👥 %d passager(s)%n"
                            + "Nous vous enverrons la confirmation de paiement dès validation.",
                    reference,
                    fromCity,
                    toCity,
                    hhmm,
                    seats);
        } catch (Exception e) {
            log.warn("buildBookingCreatedMessage failed: {}", e.getMessage());
            return "";
        }
    }

    private static String capitalizeFrenchDay(String dayName) {
        if (dayName == null || dayName.isEmpty()) {
            return "";
        }
        return dayName.substring(0, 1).toUpperCase(Locale.FRENCH) + dayName.substring(1);
    }
}
