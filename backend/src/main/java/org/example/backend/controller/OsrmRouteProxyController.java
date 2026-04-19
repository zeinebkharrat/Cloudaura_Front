package org.example.backend.controller;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Proxies driving routes to a public OSRM instance so the Angular app stays same-origin (no CORS)
 * and does not expose third-party keys. Tiles are loaded directly from OpenStreetMap in the browser.
 */
@RestController
@RequestMapping("/api/routing")
@Slf4j
public class OsrmRouteProxyController {

    /**
     * Empty OSRM-shaped body so the SPA can apply its Haversine fallback without treating the call as HTTP error.
     */
    private static final byte[] OSRM_FALLBACK_JSON =
            "{\"code\":\"Ok\",\"routes\":[]}".getBytes(StandardCharsets.UTF_8);

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    @Value("${app.osrm.base-url:https://router.project-osrm.org}")
    private String osrmBaseUrl;

    @GetMapping(value = "/driving", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> drivingRoute(
            @RequestParam double fromLat,
            @RequestParam double fromLon,
            @RequestParam double toLat,
            @RequestParam double toLon) {
        if (!isFiniteCoordinate(fromLat, fromLon) || !isFiniteCoordinate(toLat, toLon)) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":\"invalid coordinates\"}".getBytes(StandardCharsets.UTF_8));
        }
        String base = osrmBaseUrl.endsWith("/") ? osrmBaseUrl.substring(0, osrmBaseUrl.length() - 1) : osrmBaseUrl;
        String path = String.format(
                Locale.US,
                "/route/v1/driving/%f,%f;%f,%f?overview=full&geometries=geojson&steps=false",
                fromLon,
                fromLat,
                toLon,
                toLat);
        String url = base + path;
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .GET()
                    .header("User-Agent", "YallaTNPlus/1.0 (+https://yallatn.com)")
                    .timeout(Duration.ofSeconds(15))
                    .build();
            HttpResponse<byte[]> res = HTTP.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                log.warn("OSRM HTTP {} for {} — returning empty routes for client-side fallback", res.statusCode(), url);
                                return ResponseEntity.ok()
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .body(buildFallbackRoute(fromLat, fromLon, toLat, toLon));
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("OSRM request interrupted, returning fallback route", e);
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(buildFallbackRoute(fromLat, fromLon, toLat, toLon));
        } catch (IOException e) {
            log.warn("OSRM request failed, returning fallback route", e);
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(buildFallbackRoute(fromLat, fromLon, toLat, toLon));
        } catch (RuntimeException e) {
            log.warn("OSRM request failed, returning fallback route", e);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(buildFallbackRoute(fromLat, fromLon, toLat, toLon));
        }
    }

    private byte[] buildFallbackRoute(double fromLat, double fromLon, double toLat, double toLon) {
        double distanceKm = haversineKm(fromLat, fromLon, toLat, toLon);
        double durationSeconds = Math.max(60.0, (distanceKm / 65.0) * 3600.0);
        String json = String.format(
                Locale.US,
                "{\"routes\":[{\"distance\":%.1f,\"duration\":%.0f,\"geometry\":{\"type\":\"LineString\",\"coordinates\":[[%.6f,%.6f],[%.6f,%.6f]]}}],\"code\":\"Ok\"}",
                distanceKm * 1000.0,
                durationSeconds,
                fromLon,
                fromLat,
                toLon,
                toLat);
        return json.getBytes(StandardCharsets.UTF_8);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return r * c;
    }

    private static boolean isFiniteCoordinate(double lat, double lon) {
        return Double.isFinite(lat)
                && Double.isFinite(lon)
                && Math.abs(lat) <= 90
                && Math.abs(lon) <= 180;
    }
}
