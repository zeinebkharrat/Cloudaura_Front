package org.example.backend.service;

import org.example.backend.model.Transport;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class TransportPricingService {

    // Tunisia-oriented defaults (approximate; configurable in future).
    public static final double TAXI_BASE_FARE_TND = 0.90;
    public static final double TAXI_PER_KM_TND = 0.60;
    public static final double TAXI_PER_MIN_TND = 0.15;
    public static final double TAXI_NIGHT_MULTIPLIER = 1.50;
    public static final double TAXI_AIRPORT_SUPPLEMENT_TND = 4.50;
    public static final double TAXI_BAGGAGE_SUPPLEMENT_TND = 1.00;
    public static final double TAXI_MIN_TOTAL_TND = 2.00;

    public static final double BUS_INTERCITY_PER_KM_TND = 0.07;
    public static final double BUS_MIN_UNIT_TND = 1.50;

    // Fallback when route duration is not supplied by map service.
    private static final double DEFAULT_TAXI_AVG_SPEED_KMH = 28.0;

    public double estimateTaxiTotalTnd(
            double routeKm,
            Integer routeDurationMin,
            boolean night,
            boolean airportPickup,
            int baggageCount) {
        double km = Math.max(0.0, routeKm);
        int durationMin = routeDurationMin != null && routeDurationMin > 0
                ? routeDurationMin
                : estimateTaxiDurationMinutesFromKm(km);
        int bags = Math.max(0, baggageCount);

        double fare = TAXI_BASE_FARE_TND + (km * TAXI_PER_KM_TND) + (durationMin * TAXI_PER_MIN_TND);
        if (airportPickup) {
            fare += TAXI_AIRPORT_SUPPLEMENT_TND;
        }
        if (bags > 0) {
            fare += TAXI_BAGGAGE_SUPPLEMENT_TND * bags;
        }
        if (night) {
            fare *= TAXI_NIGHT_MULTIPLIER;
        }
        return round2(Math.max(TAXI_MIN_TOTAL_TND, fare));
    }

    public double estimateTaxiUnitFareTnd(double routeKm, Integer routeDurationMin) {
        return estimateTaxiTotalTnd(routeKm, routeDurationMin, false, false, 0);
    }

    public double estimateBusUnitFareTnd(double routeKm) {
        double km = Math.max(0.0, routeKm);
        return round2(Math.max(BUS_MIN_UNIT_TND, BUS_INTERCITY_PER_KM_TND * km));
    }

    public boolean isNightTrip(LocalDateTime travelDateTime) {
        if (travelDateTime == null) {
            return false;
        }
        int h = travelDateTime.getHour();
        return h >= 21 || h < 5;
    }

    /**
     * Total price in TND for the booking (single amount charged).
     * TAXI: base + km + minute + optional night multiplier (approximation).
     * BUS/PLANE/TRAIN/FERRY/VAN: unit price from DB × seats (BUS may fallback to km estimate if unit is missing).
     * CAR: transport price × max(1, rentalDays).
     */
    public double computeTotalTnd(
            Transport transport,
            int seats,
            Double routeKm,
            Integer routeDurationMin,
            Integer rentalDays) {
        return computeTotalTnd(transport, seats, routeKm, routeDurationMin, rentalDays, null);
    }

    public double computeTotalTnd(
            Transport transport,
            int seats,
            Double routeKm,
            Integer routeDurationMin,
            Integer rentalDays,
            LocalDateTime travelDateTime) {
        if (transport == null || transport.getType() == null) {
            return 0.0;
        }
        return switch (transport.getType()) {
            case TAXI -> estimateTaxiTotalTnd(
                    routeKm != null ? routeKm : 0.0,
                    routeDurationMin,
                    isNightTrip(travelDateTime),
                    false,
                    0);
            case CAR -> {
                int days = rentalDays != null && rentalDays > 0 ? rentalDays : 1;
                double unit = transport.getPrice() != null ? transport.getPrice() : 0.0;
                yield round2(unit * days);
            }
            case BUS -> {
                double unit = transport.getPrice() != null && transport.getPrice() > 0
                        ? transport.getPrice()
                        : estimateBusUnitFareTnd(routeKm != null ? routeKm : 0.0);
                yield round2(unit * Math.max(1, seats));
            }
            case PLANE, TRAIN, FERRY, VAN -> {
                double unit = transport.getPrice() != null ? transport.getPrice() : 0.0;
                yield round2(unit * Math.max(1, seats));
            }
        };
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private int estimateTaxiDurationMinutesFromKm(double km) {
        if (km <= 0) {
            return 0;
        }
        return (int) Math.round((km / DEFAULT_TAXI_AVG_SPEED_KMH) * 60.0);
    }
}
