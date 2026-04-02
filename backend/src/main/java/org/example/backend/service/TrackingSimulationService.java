package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrackingSimulationService {

    private final SimpMessagingTemplate messagingTemplate;

    private final Map<Integer, ScheduledFuture<?>> activeSimulations = new ConcurrentHashMap<>();
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(4);

    /**
     * Start a tracking simulation that broadcasts position updates along a route polyline.
     *
     * @param reservationId  the reservation being tracked
     * @param coordinates    list of [lng, lat] coordinate pairs forming the route
     */
    public void startSimulation(int reservationId, List<List<Double>> coordinates) {
        stopSimulation(reservationId);

        if (coordinates == null || coordinates.size() < 2) {
            log.warn("Cannot start tracking for reservation {}: insufficient coordinates", reservationId);
            return;
        }

        final int totalSteps = coordinates.size();
        final int[] stepRef = {0};

        ScheduledFuture<?> future = executor.scheduleAtFixedRate(() -> {
            try {
                int step = stepRef[0];
                if (step >= totalSteps) {
                    stopSimulation(reservationId);
                    messagingTemplate.convertAndSend(
                            "/topic/tracking/" + reservationId,
                            Map.of("status", "ARRIVED",
                                    "progress", 100,
                                    "reservationId", reservationId));
                    return;
                }

                List<Double> point = coordinates.get(step);
                double progress = (double) step / (totalSteps - 1) * 100;

                messagingTemplate.convertAndSend(
                        "/topic/tracking/" + reservationId,
                        Map.of(
                                "reservationId", reservationId,
                                "lat", point.size() > 1 ? point.get(1) : 0,
                                "lng", point.get(0),
                                "progress", Math.round(progress),
                                "step", step,
                                "totalSteps", totalSteps,
                                "status", "IN_TRANSIT"
                        ));

                stepRef[0]++;
            } catch (Exception e) {
                log.error("Tracking simulation error for reservation {}", reservationId, e);
                stopSimulation(reservationId);
            }
        }, 0, 2, TimeUnit.SECONDS);

        activeSimulations.put(reservationId, future);
        log.info("Started tracking simulation for reservation {} with {} points", reservationId, totalSteps);
    }

    public void stopSimulation(int reservationId) {
        ScheduledFuture<?> existing = activeSimulations.remove(reservationId);
        if (existing != null) {
            existing.cancel(false);
            log.info("Stopped tracking simulation for reservation {}", reservationId);
        }
    }

    public boolean isSimulating(int reservationId) {
        return activeSimulations.containsKey(reservationId);
    }
}
