package org.example.backend.service;

import org.example.backend.model.Transport;
import org.springframework.stereotype.Service;

@Service
public class TransportPricingService {

    /**
     * Total price in TND for the booking (single amount charged).
     * TAXI: 0.8 * routeKm * seats. BUS/PLANE/TRAIN/FERRY/VAN: unit price from DB × seats.
     * CAR: transport price × max(1, rentalDays).
     */
    public double computeTotalTnd(
            Transport transport,
            int seats,
            Double routeKm,
            Integer rentalDays) {
        if (transport == null || transport.getType() == null) {
            return 0.0;
        }
        return switch (transport.getType()) {
            case TAXI -> {
                double km = routeKm != null && routeKm > 0 ? routeKm : 0.0;
                yield round2(0.8 * km * Math.max(1, seats));
            }
            case CAR -> {
                int days = rentalDays != null && rentalDays > 0 ? rentalDays : 1;
                double unit = transport.getPrice() != null ? transport.getPrice() : 0.0;
                yield round2(unit * days);
            }
            case BUS, PLANE, TRAIN, FERRY, VAN -> {
                double unit = transport.getPrice() != null ? transport.getPrice() : 0.0;
                yield round2(unit * Math.max(1, seats));
            }
        };
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
