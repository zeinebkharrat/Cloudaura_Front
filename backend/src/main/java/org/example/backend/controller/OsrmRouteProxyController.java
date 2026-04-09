package org.example.backend.controller;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Proxies driving routes to a public OSRM instance so the Angular app stays same-origin (no CORS)
 * and does not expose third-party keys. Tiles are loaded directly from OpenStreetMap in the browser.
 */
@RestController
@RequestMapping("/api/routing")
@Slf4j
public class OsrmRouteProxyController {

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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordonnées invalides.");
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
                log.warn("OSRM HTTP {} for {}", res.statusCode(), url);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Itinéraire indisponible.");
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(res.body());
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("OSRM request failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Itinéraire indisponible.");
        }
    }

    private static boolean isFiniteCoordinate(double lat, double lon) {
        return Double.isFinite(lat)
                && Double.isFinite(lon)
                && Math.abs(lat) <= 90
                && Math.abs(lon) <= 180;
    }
}
