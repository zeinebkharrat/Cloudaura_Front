package org.example.backend.service;

import org.example.backend.model.Transport;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class TransportPricingService {

    /**
     * Legacy compatibility entrypoint used by existing callers.
     */
    public double computeTotalTnd(
            Transport transport,
            int seats,
            Double routeKm,
            Integer rentalDays) {
        return computeTotalTnd(transport, seats, routeKm, null, rentalDays, null);
    }

    /**
     * Total price in TND for the booking (single amount charged).
     * - TAXI: one-ride fare based on distance and duration (not multiplied by seats).
     * - BUS: low per-seat fare based on distance and duration.
     * - CAR: daily fare plus optional extra-km charge beyond included allowance.
     * - Others: fallback to DB unit price × seats.
     */
    public double computeTotalTnd(
            Transport transport,
            int seats,
            Double routeKm,
            Integer routeDurationMin,
            Integer rentalDays,
            LocalDateTime travelDate) {
        if (transport == null || transport.getType() == null) {
            return 0.0;
        }

        int safeSeats = Math.max(1, seats);
        double km = routeKm != null && routeKm > 0 ? routeKm : 0.0;
        int durationMin = routeDurationMin != null && routeDurationMin > 0
                ? routeDurationMin
                : estimateDurationMinutes(km);

        return switch (transport.getType()) {
            case TAXI -> {
                double fare = 2.0 + (km * 0.30) + (durationMin * 0.05);
                if (isNightTrip(travelDate)) {
                    fare *= 1.10;
                }
                yield round2(Math.max(3.5, fare));
            }
            case BUS -> {
                double perSeat = 1.2 + (km * 0.028) + (durationMin * 0.0065);
                yield round2(Math.max(1.5, perSeat) * safeSeats);
            }
            case CAR -> {
                int days = rentalDays != null && rentalDays > 0 ? rentalDays : 1;
                double baseUnit = transport.getPrice() != null ? transport.getPrice() : 52.0;
                double daily = Math.max(35.0, baseUnit * 0.50);
                double includedKm = days * 160.0;
                double extraKm = Math.max(0.0, km - includedKm);
                double total = (daily * days) + (extraKm * 0.07);
                yield round2(total);
            }
            case PLANE, TRAIN, FERRY, VAN -> {
                double unit = transport.getPrice() != null ? transport.getPrice() : 0.0;
                yield round2(unit * safeSeats);
            }
        };
    }

    private static int estimateDurationMinutes(double km) {
        if (km <= 0) {
            return 0;
        }
        return (int) Math.round((km / 60.0) * 60.0);
    }

    private static boolean isNightTrip(LocalDateTime travelDate) {
        if (travelDate == null) {
            return false;
        }
        int h = travelDate.getHour();
        return h >= 22 || h < 6;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
