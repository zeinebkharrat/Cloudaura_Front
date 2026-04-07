package org.example.backend.service;

import java.time.format.DateTimeFormatter;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;

/** JSON string embedded in transport ticket QR codes (same format as {@code TicketController}). */
public final class TransportTicketQrPayload {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private TransportTicketQrPayload() {}

    public static String jsonForReservation(TransportReservation res) {
        if (res == null) {
            return "{}";
        }
        String ref = esc(res.getReservationRef());
        String fn = esc(res.getPassengerFirstName());
        String ln = esc(res.getPassengerLastName());
        String dep = "";
        String arr = "";
        Transport t = res.getTransport();
        if (t != null) {
            City d = t.getDepartureCity();
            City a = t.getArrivalCity();
            if (d != null && d.getName() != null) {
                dep = esc(d.getName());
            }
            if (a != null && a.getName() != null) {
                arr = esc(a.getName());
            }
        }
        String dateStr = res.getTravelDate() != null ? res.getTravelDate().format(FMT) : "N/A";
        return String.format(
                "{\"ref\":\"%s\",\"passenger\":\"%s %s\",\"route\":\"%s → %s\",\"date\":\"%s\"}",
                ref, fn, ln, dep, arr, dateStr);
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
