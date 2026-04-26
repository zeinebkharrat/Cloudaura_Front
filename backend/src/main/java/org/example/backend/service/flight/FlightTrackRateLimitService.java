package org.example.backend.service.flight;

import org.example.backend.config.OpenSkyProperties;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rolling 60s window per client key (IP) for {@code /api/flights/track*} — limits abuse of upstream OpenSky.
 */
@Service
public class FlightTrackRateLimitService {

    private final OpenSkyProperties openSkyProperties;
    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public FlightTrackRateLimitService(OpenSkyProperties openSkyProperties) {
        this.openSkyProperties = openSkyProperties;
    }

    public boolean allow(String clientKey) {
        String key = (clientKey == null || clientKey.isBlank()) ? "unknown" : clientKey.trim();
        int max = Math.max(6, openSkyProperties.getTrackRateLimitPerMinute());
        long now = System.currentTimeMillis();
        long windowStart = now - 60_000L;
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst() != null && q.peekFirst() < windowStart) {
                q.pollFirst();
            }
            if (q.size() >= max) {
                return false;
            }
            q.addLast(now);
            return true;
        }
    }
}
