package org.example.backend.service.flight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.config.OpenSkyProperties;
import org.example.backend.dto.flight.AircraftTrackResponse;
import org.example.backend.dto.flight.FlightDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Live aircraft positions via OpenSky {@code /states/all} with optional ICAO24 resolution from
 * {@code /flights/departure} (authenticated) or a small bounding-box {@code /states/all} scan (anonymous).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AircraftPositionService {

    private static final Pattern ICAO24_HEX = Pattern.compile("^[a-fA-F0-9]{4,6}$");
    private static final Pattern DIGITS_SUFFIX = Pattern.compile("(\\d{1,4})$");

    private final org.springframework.web.reactive.function.client.WebClient openSkyWebClient;
    private final OpenSkyProperties props;
    private final ObjectMapper objectMapper;
    private final AviationStackFlightService aviationStackFlightService;

    private LoadingCache<String, AircraftTrackResponse> stateByIcao;
    private LoadingCache<String, String> icaoResolve;

    @PostConstruct
    void initCaches() {
        int stateTtl = Math.max(5, props.getStateCacheSeconds());
        int resolveTtl = Math.max(15, props.getResolveCacheSeconds());
        this.stateByIcao = Caffeine.newBuilder()
                .maximumSize(512)
                .expireAfterWrite(java.time.Duration.ofSeconds(stateTtl))
                .build(this::loadStateUncached);
        this.icaoResolve = Caffeine.newBuilder()
                .maximumSize(256)
                .expireAfterWrite(java.time.Duration.ofSeconds(resolveTtl))
                .build(this::resolveIcao24ForQueryUncached);
    }

    public AircraftTrackResponse trackByIcao24(String icao24Raw) {
        if (icao24Raw == null || icao24Raw.isBlank()) {
            return unavailable("INVALID_ICAO24", null, null, null);
        }
        String icao = normalizeIcao24(icao24Raw);
        if (!ICAO24_HEX.matcher(icao).matches()) {
            return unavailable("INVALID_ICAO24", null, null, null);
        }
        try {
            return stateByIcao.get(icao);
        } catch (Exception e) {
            log.warn("OpenSky track cache get failed: {}", e.getMessage());
            return unavailable("UPSTREAM_ERROR", icao, null, null);
        }
    }

    public AircraftTrackResponse trackByFlightQuery(String flightQuery, String date, String depIata, String arrIata) {
        if (flightQuery == null || flightQuery.isBlank()) {
            return unavailable("INVALID_FLIGHT", null, null, null);
        }
        String dateUse = normalizeDate(date);
        String dep = depIata == null ? "" : depIata.trim().toUpperCase(Locale.ROOT);
        String arr = arrIata == null ? "" : arrIata.trim().toUpperCase(Locale.ROOT);
        String fq = flightQuery.trim().toUpperCase(Locale.ROOT);
        String cacheKey = fq + "|" + dateUse + "|" + dep + "|" + arr;
        List<FlightDto> scheduleRows = aviationStackFlightService.getFlightsByFlightQuery(fq, dateUse, 24);
        String scheduleStatus = pickFlight(scheduleRows, dep, arr).map(FlightDto::getStatus).orElse(null);
        String icao = icaoResolve.get(cacheKey);
        if (icao == null || icao.isEmpty()) {
            return unavailable("NO_ICAO24", null, null, scheduleStatus);
        }
        AircraftTrackResponse pos = trackByIcao24(icao);
        String mergedIcao = (pos.getIcao24() != null && !pos.getIcao24().isBlank()) ? pos.getIcao24() : icao;
        String mergedStatus = scheduleStatus != null ? scheduleStatus : pos.getFlightStatus();
        return AircraftTrackResponse.builder()
                .available(pos.isAvailable())
                .unavailableReason(pos.getUnavailableReason())
                .icao24(mergedIcao)
                .callsign(pos.getCallsign())
                .latitude(pos.getLatitude())
                .longitude(pos.getLongitude())
                .baroAltitudeMeters(pos.getBaroAltitudeMeters())
                .geoAltitudeMeters(pos.getGeoAltitudeMeters())
                .headingTrueDeg(pos.getHeadingTrueDeg())
                .groundSpeedMps(pos.getGroundSpeedMps())
                .onGround(pos.getOnGround())
                .verticalRateMps(pos.getVerticalRateMps())
                .updatedAt(pos.getUpdatedAt())
                .flightStatus(mergedStatus)
                .build();
    }

    private String resolveIcao24ForQueryUncached(String cacheKey) {
        try {
            String[] parts = cacheKey.split("\\|", -1);
            if (parts.length < 4) {
                return "";
            }
            String flightQuery = parts[0];
            String dateUse = parts[1];
            String dep = parts[2];
            String arr = parts[3];
            List<FlightDto> list = aviationStackFlightService.getFlightsByFlightQuery(flightQuery, dateUse, 24);
            Optional<FlightDto> pick = pickFlight(list, dep, arr);
            if (pick.isEmpty()) {
                return "";
            }
            FlightDto f = pick.get();
            String fromBoard = tryDepartureBoard(f, flightQuery);
            if (fromBoard != null && !fromBoard.isEmpty()) {
                return fromBoard;
            }
            return tryBboxStates(f, flightQuery);
        } catch (Exception e) {
            log.warn("ICAO24 resolve failed for key {}: {}", cacheKey, e.getMessage());
            return "";
        }
    }

    private static Optional<FlightDto> pickFlight(List<FlightDto> list, String dep, String arr) {
        if (list == null || list.isEmpty()) {
            return Optional.empty();
        }
        List<FlightDto> cur = new ArrayList<>(list);
        if (dep != null && !dep.isBlank()) {
            List<FlightDto> next = new ArrayList<>();
            for (FlightDto f : cur) {
                if (dep.equalsIgnoreCase(safeIata(f.getDepartureIata()))) {
                    next.add(f);
                }
            }
            if (!next.isEmpty()) {
                cur = next;
            }
        }
        if (arr != null && !arr.isBlank()) {
            List<FlightDto> next = new ArrayList<>();
            for (FlightDto f : cur) {
                if (arr.equalsIgnoreCase(safeIata(f.getArrivalIata()))) {
                    next.add(f);
                }
            }
            if (!next.isEmpty()) {
                cur = next;
            }
        }
        return Optional.of(cur.get(0));
    }

    private static String safeIata(String s) {
        return s == null ? "" : s.trim().toUpperCase(Locale.ROOT);
    }

    private String tryDepartureBoard(FlightDto f, String flightQuery) {
        String depIata = safeIata(f.getDepartureIata());
        String icaoAirport = AirportIataToIcao.toIcaoOrNull(depIata);
        if (icaoAirport == null) {
            return "";
        }
        long center = departureEpochSeconds(f, flightQuery);
        long begin = center - 3_600L;
        long end = center + 7_200L;
        if (end - begin > 172_800L) {
            end = begin + 172_000L;
        }
        final long beginParam = begin;
        final long endParam = end;
        try {
            String body = openSkyWebClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/flights/departure")
                            .queryParam("airport", icaoAirport)
                            .queryParam("begin", beginParam)
                            .queryParam("end", endParam)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            JsonNode arr = objectMapper.readTree(body);
            if (!arr.isArray()) {
                return "";
            }
            String digitSuffix = trailingDigits(
                    Optional.ofNullable(f.getFlightNumber()).orElse(flightQuery).replaceAll("\\s+", "").toUpperCase(Locale.ROOT));
            if (digitSuffix.isEmpty()) {
                digitSuffix = trailingDigits(flightQuery.replaceAll("\\s+", "").toUpperCase(Locale.ROOT));
            }
            String bestIcao = "";
            long bestDelta = Long.MAX_VALUE;
            for (JsonNode node : arr) {
                if (node == null || !node.isObject()) {
                    continue;
                }
                String cs = text(node, "callsign");
                if (!callsignMatchesDigits(cs, digitSuffix)) {
                    continue;
                }
                String icao = text(node, "icao24");
                if (icao == null || icao.isBlank()) {
                    continue;
                }
                long first = longOrZero(node, "firstSeen");
                long delta = Math.abs(first - center);
                if (delta < bestDelta) {
                    bestDelta = delta;
                    bestIcao = normalizeIcao24(icao);
                }
            }
            return bestIcao;
        } catch (WebClientResponseException e) {
            int sc = e.getStatusCode().value();
            if (sc == HttpStatus.NOT_FOUND.value() || sc == HttpStatus.FORBIDDEN.value() || sc == HttpStatus.UNAUTHORIZED.value()) {
                log.debug("OpenSky departure board unavailable (HTTP {}), falling back to bbox.", sc);
                return "";
            }
            log.warn("OpenSky departure HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "";
        } catch (Exception e) {
            log.debug("OpenSky departure parse failed: {}", e.getMessage());
            return "";
        }
    }

    private String tryBboxStates(FlightDto f, String flightQuery) {
        String depIata = safeIata(f.getDepartureIata());
        double[] c = AirportIataCoordinates.getOrNull(depIata);
        if (c == null) {
            return "";
        }
        double lat = c[0];
        double lon = c[1];
        double d = 1.1;
        String digitSuffix = trailingDigits(
                Optional.ofNullable(f.getFlightNumber()).orElse(flightQuery).replaceAll("\\s+", "").toUpperCase(Locale.ROOT));
        if (digitSuffix.isEmpty()) {
            digitSuffix = trailingDigits(flightQuery.replaceAll("\\s+", "").toUpperCase(Locale.ROOT));
        }
        if (digitSuffix.isEmpty()) {
            return "";
        }
        try {
            String body = openSkyWebClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/states/all")
                            .queryParam("lamin", lat - d)
                            .queryParam("lamax", lat + d)
                            .queryParam("lomin", lon - d)
                            .queryParam("lomax", lon + d)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            JsonNode root = objectMapper.readTree(body);
            JsonNode states = root.get("states");
            if (states == null || !states.isArray()) {
                return "";
            }
            for (JsonNode row : states) {
                if (row == null || !row.isArray() || row.size() < 11) {
                    continue;
                }
                String cs = textAt(row, 1);
                if (!callsignMatchesDigits(cs, digitSuffix)) {
                    continue;
                }
                String icao = textAt(row, 0);
                if (icao != null && !icao.isBlank()) {
                    return normalizeIcao24(icao);
                }
            }
        } catch (WebClientResponseException e) {
            log.warn("OpenSky bbox states HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.debug("OpenSky bbox states failed: {}", e.getMessage());
        }
        return "";
    }

    private AircraftTrackResponse loadStateUncached(String icaoLower) {
        try {
            String body = openSkyWebClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/states/all")
                            .queryParam("icao24", icaoLower)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            JsonNode root = objectMapper.readTree(body);
            return mapFirstState(root, icaoLower, null);
        } catch (WebClientResponseException e) {
            log.warn("OpenSky states HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return unavailable("UPSTREAM_HTTP_" + e.getStatusCode().value(), icaoLower, null, null);
        } catch (Exception e) {
            log.warn("OpenSky states failed: {}", e.getMessage());
            return unavailable("UPSTREAM_ERROR", icaoLower, null, null);
        }
    }

    private AircraftTrackResponse mapFirstState(JsonNode root, String icaoHint, String flightStatus) {
        JsonNode states = root.get("states");
        if (states == null || !states.isArray() || states.isEmpty()) {
            return unavailable("NO_STATE", icaoHint, null, flightStatus);
        }
        JsonNode row = states.get(0);
        if (row == null || !row.isArray()) {
            return unavailable("NO_STATE", icaoHint, null, flightStatus);
        }
        Boolean onGround = boolAt(row, 8);
        Double lat = doubleAt(row, 6);
        Double lon = doubleAt(row, 5);
        if (Boolean.TRUE.equals(onGround) && (lat == null || lon == null)) {
            return unavailable("ON_GROUND", icaoHint, textAt(row, 1), flightStatus);
        }
        if (lat == null || lon == null) {
            return unavailable("NO_POSITION", icaoHint, textAt(row, 1), flightStatus);
        }
        long timePos = longAt(row, 3);
        String updated = timePos > 0
                ? Instant.ofEpochSecond(timePos).toString()
                : Instant.now().toString();

        return AircraftTrackResponse.builder()
                .available(true)
                .unavailableReason(null)
                .icao24(icaoHint)
                .callsign(trimCallsign(textAt(row, 1)))
                .latitude(lat)
                .longitude(lon)
                .baroAltitudeMeters(doubleAt(row, 7))
                .geoAltitudeMeters(doubleAt(row, 13))
                .headingTrueDeg(doubleAt(row, 10))
                .groundSpeedMps(doubleAt(row, 9))
                .onGround(onGround)
                .verticalRateMps(doubleAt(row, 11))
                .updatedAt(updated)
                .flightStatus(flightStatus)
                .build();
    }

    private static AircraftTrackResponse unavailable(String reason, String icao, String callsign, String flightStatus) {
        return AircraftTrackResponse.builder()
                .available(false)
                .unavailableReason(reason)
                .icao24(icao)
                .callsign(callsign)
                .latitude(null)
                .longitude(null)
                .updatedAt(Instant.now().toString())
                .flightStatus(flightStatus)
                .build();
    }

    private static String normalizeIcao24(String raw) {
        return raw.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeDate(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now(ZoneOffset.UTC).toString();
        }
        String d = date.trim();
        return d.length() >= 10 ? d.substring(0, 10) : d;
    }

    private static long departureEpochSeconds(FlightDto f, String flightQueryFallbackDate) {
        String iso = f.getDepartureTime();
        if (iso != null && !iso.isBlank()) {
            try {
                return Instant.parse(iso).getEpochSecond();
            } catch (DateTimeParseException ignored) {
                try {
                    return java.time.OffsetDateTime.parse(iso).toInstant().getEpochSecond();
                } catch (Exception ignored2) {
                    // fall through
                }
            }
        }
        try {
            LocalDate d = LocalDate.parse(normalizeDate(flightQueryFallbackDate));
            return d.atStartOfDay().toInstant(ZoneOffset.UTC).getEpochSecond() + 43_200L;
        } catch (Exception e) {
            return Instant.now().getEpochSecond();
        }
    }

    private static String trailingDigits(String compactFlight) {
        if (compactFlight == null || compactFlight.isEmpty()) {
            return "";
        }
        Matcher m = DIGITS_SUFFIX.matcher(compactFlight);
        return m.find() ? m.group(1) : "";
    }

    private static boolean callsignMatchesDigits(String callsign, String digitSuffix) {
        if (digitSuffix == null || digitSuffix.isEmpty()) {
            return false;
        }
        if (callsign == null || callsign.isBlank()) {
            return false;
        }
        String c = callsign.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        Matcher m = DIGITS_SUFFIX.matcher(c);
        return m.find() && digitSuffix.equals(m.group(1));
    }

    private static String text(JsonNode o, String field) {
        JsonNode n = o.get(field);
        return n == null || n.isNull() ? null : n.asText();
    }

    private static long longOrZero(JsonNode o, String field) {
        JsonNode n = o.get(field);
        return n == null || !n.isNumber() ? 0L : n.asLong();
    }

    private static String textAt(JsonNode row, int i) {
        if (row == null || i >= row.size()) {
            return null;
        }
        JsonNode n = row.get(i);
        return n == null || n.isNull() ? null : n.asText();
    }

    private static Double doubleAt(JsonNode row, int i) {
        if (row == null || i >= row.size()) {
            return null;
        }
        JsonNode n = row.get(i);
        if (n == null || n.isNull() || !n.isNumber()) {
            return null;
        }
        return n.asDouble();
    }

    private static long longAt(JsonNode row, int i) {
        if (row == null || i >= row.size()) {
            return 0L;
        }
        JsonNode n = row.get(i);
        return n == null || n.isNull() || !n.isNumber() ? 0L : n.asLong();
    }

    private static Boolean boolAt(JsonNode row, int i) {
        if (row == null || i >= row.size()) {
            return null;
        }
        JsonNode n = row.get(i);
        if (n == null || n.isNull()) {
            return null;
        }
        if (n.isBoolean()) {
            return n.asBoolean();
        }
        if (n.isNumber()) {
            return n.asInt() != 0;
        }
        return null;
    }

    private static String trimCallsign(String cs) {
        return cs == null ? null : cs.trim();
    }
}
