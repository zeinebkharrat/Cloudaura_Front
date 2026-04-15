package org.example.backend.service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
@Slf4j
public class TransportTrackingSseService {

    private final ConcurrentHashMap<Integer, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Integer, String> lastStageByReservation = new ConcurrentHashMap<>();

    public SseEmitter subscribe(int reservationId) {
        SseEmitter emitter = new SseEmitter(0L);
        subscribers
                .computeIfAbsent(reservationId, k -> new CopyOnWriteArrayList<>())
                .add(emitter);
        emitter.onCompletion(() -> removeEmitter(reservationId, emitter));
        emitter.onTimeout(() -> removeEmitter(reservationId, emitter));
        emitter.onError(e -> removeEmitter(reservationId, emitter));
        return emitter;
    }

    public void send(int reservationId, String eventName, Map<String, Object> payload) {
        List<SseEmitter> list = subscribers.get(reservationId);
        if (list == null || list.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException e) {
                log.debug("SSE send failed for reservation {}: {}", reservationId, e.getMessage());
                removeEmitter(reservationId, emitter);
            }
        }
    }

    public void complete(int reservationId) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.remove(reservationId);
        lastStageByReservation.remove(reservationId);
        if (list == null) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.complete();
            } catch (Exception ignored) {
                // ignore
            }
        }
    }

    public String getLastStage(int reservationId) {
        return lastStageByReservation.get(reservationId);
    }

    public void setLastStage(int reservationId, String stage) {
        lastStageByReservation.put(reservationId, stage);
    }

    private void removeEmitter(int reservationId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(reservationId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                subscribers.remove(reservationId, list);
            }
        }
    }
}
