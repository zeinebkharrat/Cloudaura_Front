package org.example.backend.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.example.backend.model.City;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.util.GeoUtils;
import org.springframework.stereotype.Service;

/**
 * Derives journey stages from posted GPS positions and pushes SSE events (at most once per stage).
 */
@Service
@RequiredArgsConstructor
public class TransportTrackingStageService {

    public static final String DEPARTURE_STARTED = "DEPARTURE_STARTED";
    public static final String MID_JOURNEY = "MID_JOURNEY";
    public static final String NEAR_DESTINATION_5KM = "NEAR_DESTINATION_5KM";
    public static final String ARRIVED = "ARRIVED";

    private final TransportReservationRepository reservationRepository;
    private final TransportTrackingSseService sseService;

    public void handlePosition(int reservationId, double lat, double lng) {
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElse(null);
        if (res == null) {
            return;
        }
        City dest = res.getTransport() != null ? res.getTransport().getArrivalCity() : null;
        if (dest == null
                || dest.getLatitude() == null
                || dest.getLongitude() == null) {
            return;
        }

        double dKm = GeoUtils.haversineKm(lat, lng, dest.getLatitude(), dest.getLongitude());

        maybeEmit(reservationId, DEPARTURE_STARTED, dKm);
        if (dKm <= 50) {
            maybeEmit(reservationId, MID_JOURNEY, dKm);
        }
        if (dKm <= 5) {
            maybeEmit(reservationId, NEAR_DESTINATION_5KM, dKm);
        }
        if (dKm <= 0.2) {
            maybeEmit(reservationId, ARRIVED, dKm);
        }
    }

    private void maybeEmit(int reservationId, String stage, double distanceKm) {
        String last = sseService.getLastStage(reservationId);
        if (Objects.equals(last, stage)) {
            return;
        }
        if (shouldSkipBecauseEarlierStageMissing(stage, last)) {
            return;
        }
        sseService.setLastStage(reservationId, stage);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("stage", stage);
        payload.put("distanceKm", Math.round(distanceKm * 100.0) / 100.0);
        sseService.send(reservationId, "journey", payload);
    }

    private static boolean shouldSkipBecauseEarlierStageMissing(String stage, String last) {
        if (last == null) {
            return !DEPARTURE_STARTED.equals(stage);
        }
        int ordLast = order(last);
        int ordNew = order(stage);
        return ordNew < ordLast;
    }

    private static int order(String stage) {
        if (DEPARTURE_STARTED.equals(stage)) {
            return 1;
        }
        if (MID_JOURNEY.equals(stage)) {
            return 2;
        }
        if (NEAR_DESTINATION_5KM.equals(stage)) {
            return 3;
        }
        if (ARRIVED.equals(stage)) {
            return 4;
        }
        return 0;
    }
}
